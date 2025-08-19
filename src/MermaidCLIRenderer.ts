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
					// Create input and output file paths
					const inputFile = path.join(tempDir, `${chart.name}.mmd`);
					const outputFile = path.join(tempDir, `${chart.name}.svg`);
					const configFile = path.join(tempDir, 'config.json');
					
					// Write mermaid definition to file
					await fs.writeFile(inputFile, chart.data, 'utf-8');
					
					// Build command arguments
					const args = [
						'npx', '@mermaid-js/mermaid-cli@11',
						'-i', inputFile,
						'-o', outputFile,
						'-f', 'svg',
						'-b', 'transparent'
					];
					
					// Write config and add config argument if we have one
					if (this.mermaidConfig) {
						const config = {
							theme: this.mermaidConfig.theme || 'default',
							themeVariables: this.mermaidConfig.themeVariables || {}
						};
						await fs.writeFile(configFile, JSON.stringify(config), 'utf-8');
						args.push('-c', configFile);
					}
					
					// Run mermaid-cli to generate SVG
					console.log(`Rendering Mermaid chart ${chart.name} with mermaid-cli...`);
					
					const command = args.join(' ');
					await execAsync(command);
					
					// Read the generated SVG
					const svgContent = await fs.readFile(outputFile, 'utf-8');
					
					// Clean up the SVG to ensure transparent background
					let cleanedSvg = svgContent;
					cleanedSvg = cleanedSvg.replace(/style="[^"]*background[^"]*"/gi, 'style=""');
					cleanedSvg = cleanedSvg.replace(
						/<svg/,
						'<svg style="background: transparent"'
					);
					
					// Convert to Buffer
					const svgBuffer = Buffer.from(cleanedSvg, 'utf-8');
					
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