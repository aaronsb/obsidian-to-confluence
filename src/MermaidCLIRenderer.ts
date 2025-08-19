import { ChartData, MermaidRenderer } from "@markdown-confluence/lib";
import { MermaidConfig } from "mermaid";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export class MermaidCLIRenderer implements MermaidRenderer {
	private mermaidConfig: MermaidConfig;

	constructor(mermaidConfig?: MermaidConfig) {
		this.mermaidConfig = mermaidConfig || {};
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
					const configFile = path.join(tempDir, 'config.json');
					
					// Write mermaid definition to file
					await fs.writeFile(inputFile, chart.data, 'utf-8');
					
					// Write config if we have one
					let configArgs = '';
					if (this.mermaidConfig && this.mermaidConfig.theme) {
						const config = {
							theme: this.mermaidConfig.theme,
							themeVariables: this.mermaidConfig.themeVariables || {}
						};
						await fs.writeFile(configFile, JSON.stringify(config), 'utf-8');
						configArgs = ` -c "${configFile}"`;
					}
					
					// Run mermaid-cli to generate SVG
					console.log(`Rendering Mermaid chart ${chart.name} with mermaid-cli...`);
					
					// Build the command with proper arguments
					// Note: -b for backgroundColor, -q for quiet mode
					const command = `npx --yes @mermaid-js/mermaid-cli@11 -i "${inputFile}" -o "${outputFile}" -b transparent -q${configArgs}`;
					
					console.log(`Executing: ${command}`);
					
					const { stdout, stderr } = await execAsync(command);
					if (stderr && !stderr.includes('warn')) {
						console.error(`mermaid-cli stderr: ${stderr}`);
					}
					
					// Read the generated SVG
					let svgContent = await fs.readFile(outputFile, 'utf-8');
					
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