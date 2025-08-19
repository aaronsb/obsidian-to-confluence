import { ChartData, MermaidRenderer } from "@markdown-confluence/lib";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export type PNGQuality = 'low' | 'medium' | 'high';

export class MermaidPNGRenderer implements MermaidRenderer {
	private quality: PNGQuality;
	
	constructor(quality: PNGQuality = 'high') {
		this.quality = quality;
	}

	async captureMermaidCharts(charts: ChartData[]): Promise<Map<string, Buffer>> {
		const capturedCharts = new Map<string, Buffer>();
		
		// Create a temporary directory for processing
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mermaid-'));
		
		// Set scale factor based on quality
		const scaleFactors = {
			'low': 1,
			'medium': 1.5,
			'high': 2
		};
		const scale = scaleFactors[this.quality];
		
		try {
			// Process each chart
			for (const chart of charts) {
				try {
					// Change extension from .svg to .png
					const chartName = chart.name.replace(/\.svg$/, '.png');
					const baseName = chartName.replace(/\.png$/, '');
					
					// Create input and output file paths
					const inputFile = path.join(tempDir, `${baseName}.mmd`);
					const outputFile = path.join(tempDir, `${baseName}.png`);
					
					// Write mermaid definition to file
					await fs.writeFile(inputFile, chart.data, 'utf-8');
					
					// Run mermaid-cli to generate PNG with transparent background
					// Using default theme for maximum compatibility
					console.log(`[MermaidPNGRenderer] Rendering ${chartName} as PNG (quality: ${this.quality}, scale: ${scale})...`);
					
					const command = `npx --yes @mermaid-js/mermaid-cli@11 -i "${inputFile}" -o "${outputFile}" -b transparent -q -s ${scale}`;
					
					const { stdout, stderr } = await execAsync(command);
					if (stderr && !stderr.includes('warn')) {
						console.error(`mermaid-cli stderr: ${stderr}`);
					}
					
					// Read the generated PNG
					const pngBuffer = await fs.readFile(outputFile);
					
					// Store with the PNG chart name
					capturedCharts.set(chartName, pngBuffer);
					
					console.log(`[MermaidPNGRenderer] Successfully rendered ${chartName} (${pngBuffer.length} bytes)`);
					
				} catch (error) {
					console.error(`Failed to render Mermaid chart ${chart.name}:`, error);
					// Create an error placeholder PNG (1x1 transparent pixel)
					const errorPng = Buffer.from([
						0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
						0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
						0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
						0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
						0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
						0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x00,
						0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x8D,
						0xB4, 0x19, 0x3A, 0x00, 0x00, 0x00, 0x00, 0x49,
						0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
					]);
					const chartName = chart.name.replace(/\.svg$/, '.png');
					capturedCharts.set(chartName, errorPng);
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