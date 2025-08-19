import { ChartData, MermaidRenderer } from "@markdown-confluence/lib";
import { MermaidConfig } from "mermaid";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { JSDOM } from "jsdom";

const execAsync = promisify(exec);

export class MermaidCLIRenderer implements MermaidRenderer {
	constructor(mermaidConfig?: MermaidConfig) {
		// Ignoring mermaidConfig to ensure Confluence compatibility
		// Custom themes generate hsl() and rgb() colors that Confluence can't render
	}

	async captureMermaidCharts(charts: ChartData[]): Promise<Map<string, Buffer>> {
		const capturedCharts = new Map<string, Buffer>();
		
		// Create a temporary directory for processing
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mermaid-'));
		
		try {
			// Process each chart
			for (const chart of charts) {
				try {
					// Remove .svg extension from chart name if present for file operations
					const baseName = chart.name.replace(/\.svg$/, '');
					
					// Create input and output file paths
					const inputFile = path.join(tempDir, `${baseName}.mmd`);
					const outputFile = path.join(tempDir, `${baseName}.svg`);
					
					// Write mermaid definition to file
					await fs.writeFile(inputFile, chart.data, 'utf-8');
					
					// Skip custom config - use mermaid-cli defaults for compatibility
					// Custom themes from Obsidian generate incompatible color formats (hsl, rgb)
					// that Confluence can't render properly
					
					// Run mermaid-cli to generate SVG with default theme
					console.log(`Rendering Mermaid chart ${chart.name} with mermaid-cli (default theme)...`);
					
					// Build the command with proper arguments
					// Note: -b for backgroundColor, -q for quiet mode
					// Explicitly NOT passing any theme config to ensure compatibility
					const command = `npx --yes @mermaid-js/mermaid-cli@11 -i "${inputFile}" -o "${outputFile}" -b transparent -q`;
					
					console.log(`Executing: ${command}`);
					
					const { stdout, stderr } = await execAsync(command);
					if (stderr && !stderr.includes('warn')) {
						console.error(`mermaid-cli stderr: ${stderr}`);
					}
					
					// Read the generated SVG
					let svgContent = await fs.readFile(outputFile, 'utf-8');
					
					// Decode all HTML entities that mermaid-cli might add
					// This is crucial for SVG to be valid XML
					const htmlEntityMap: { [key: string]: string } = {
						'&gt;': '>',
						'&lt;': '<',
						'&amp;': '&',
						'&quot;': '"',
						'&apos;': "'",
						'&#39;': "'",
						'&#x27;': "'",
						'&#x2F;': '/',
						'&#x60;': '`',
						'&#x3D;': '=',
						'&nbsp;': ' ',
						'&copy;': '©',
						'&reg;': '®',
						'&trade;': '™',
						'&euro;': '€',
						'&pound;': '£',
						'&yen;': '¥',
						'&cent;': '¢'
					};
					
					// Replace all HTML entities
					for (const [entity, char] of Object.entries(htmlEntityMap)) {
						const regex = new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
						svgContent = svgContent.replace(regex, char);
					}
					
					// Also handle numeric entities (both decimal and hex)
					svgContent = svgContent
						.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
						.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
					
					// Parse SVG with JSDOM to properly handle color conversions
					const dom = new JSDOM(svgContent, { contentType: 'image/svg+xml' });
					const document = dom.window.document;
					
					// Helper function to convert hsl to hex
					const hslToHex = (h: number, s: number, l: number): string => {
						l = l / 100;
						const a = s * Math.min(l, 1 - l) / 100;
						const f = (n: number) => {
							const k = (n + h / 30) % 12;
							const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
							return Math.round(255 * color).toString(16).padStart(2, '0');
						};
						return `#${f(0)}${f(8)}${f(4)}`;
					};
					
					// Helper function to convert rgb to hex
					const rgbToHex = (r: number, g: number, b: number): string => {
						const toHex = (n: number) => n.toString(16).padStart(2, '0');
						return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
					};
					
					// Function to convert color values in a string
					const convertColors = (str: string): string => {
						// Convert hsl()
						str = str.replace(
							/hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)/g,
							(match, h, s, l) => {
								try {
									return hslToHex(parseFloat(h), parseFloat(s), parseFloat(l));
								} catch {
									return match;
								}
							}
						);
						
						// Convert rgb()
						str = str.replace(
							/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
							(match, r, g, b) => {
								try {
									return rgbToHex(parseInt(r), parseInt(g), parseInt(b));
								} catch {
									return match;
								}
							}
						);
						
						// Convert rgba() - drop alpha
						str = str.replace(
							/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)/g,
							(match, r, g, b) => {
								try {
									return rgbToHex(parseInt(r), parseInt(g), parseInt(b));
								} catch {
									return match;
								}
							}
						);
						
						return str;
					};
					
					// Process all style elements
					const styleElements = document.querySelectorAll('style');
					styleElements.forEach(style => {
						if (style.textContent) {
							style.textContent = convertColors(style.textContent);
						}
					});
					
					// Process all elements with style attributes
					const elementsWithStyle = document.querySelectorAll('[style]');
					elementsWithStyle.forEach(element => {
						const style = element.getAttribute('style');
						if (style) {
							element.setAttribute('style', convertColors(style));
						}
					});
					
					// Process all elements with fill attributes
					const elementsWithFill = document.querySelectorAll('[fill]');
					elementsWithFill.forEach(element => {
						const fill = element.getAttribute('fill');
						if (fill) {
							element.setAttribute('fill', convertColors(fill));
						}
					});
					
					// Process all elements with stroke attributes
					const elementsWithStroke = document.querySelectorAll('[stroke]');
					elementsWithStroke.forEach(element => {
						const stroke = element.getAttribute('stroke');
						if (stroke) {
							element.setAttribute('stroke', convertColors(stroke));
						}
					});
					
					// Serialize back to string
					svgContent = dom.serialize();
					
					// Ensure the SVG has proper XML declaration for maximum compatibility
					if (!svgContent.startsWith('<?xml')) {
						svgContent = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgContent;
					}
					
					// Convert to Buffer
					const svgBuffer = Buffer.from(svgContent, 'utf-8');
					
					// Store with the original chart name
					capturedCharts.set(chart.name, svgBuffer);
					
					console.log(`Successfully rendered ${chart.name}`);
					
				} catch (error) {
					console.error(`Failed to render Mermaid chart ${chart.name}:`, error);
					// Create an error placeholder SVG
					const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">
	<rect width="400" height="100" fill="#ffeeee" stroke="#ff0000"/>
	<text x="200" y="50" text-anchor="middle" fill="#ff0000">
		Error rendering chart: ${chart.name}
	</text>
</svg>`;
					capturedCharts.set(chart.name, Buffer.from(errorSvg, 'utf-8'));
				}
			}
		} finally {
			// Clean up temp directory
			try {
				const files = await fs.readdir(tempDir);
				for (const file of files) {
					await fs.unlink(path.join(tempDir, file));
				}
				await fs.rmdir(tempDir);
			} catch (cleanupError) {
				console.warn('Failed to clean up temp directory:', cleanupError);
			}
		}

		return capturedCharts;
	}
}