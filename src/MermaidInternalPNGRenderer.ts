import { ChartData, MermaidRenderer } from "@markdown-confluence/lib";
import { loadMermaid } from "obsidian";
import { Mermaid } from "mermaid";

export type PNGQuality = 'low' | 'medium' | 'high';

export class MermaidInternalPNGRenderer implements MermaidRenderer {
	private quality: PNGQuality;
	
	constructor(quality: PNGQuality = 'high') {
		this.quality = quality;
	}

	async captureMermaidCharts(charts: ChartData[]): Promise<Map<string, Buffer>> {
		const capturedCharts = new Map<string, Buffer>();
		
		// Load Mermaid from Obsidian
		const mermaid = (await loadMermaid()) as Mermaid;
		
		// Configure mermaid for rendering
		mermaid.initialize({
			startOnLoad: false,
			theme: 'default',  // Use default theme for compatibility
			themeVariables: {
				background: 'transparent'
			},
			flowchart: {
				htmlLabels: false  // Avoid foreignObject elements
			}
		});
		
		// Set scale based on quality
		const scaleFactors = {
			'low': 1,
			'medium': 1.5,
			'high': 2
		};
		const scale = scaleFactors[this.quality];
		
		for (const chart of charts) {
			try {
				// Change extension from .svg to .png
				const chartName = chart.name.replace(/\.svg$/, '.png');
				
				console.log(`[MermaidInternalPNGRenderer] Rendering ${chartName} (quality: ${this.quality})...`);
				
				// Create a unique ID for this chart
				const chartId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				
				// Create a container div for rendering
				const container = document.createElement('div');
				container.id = chartId;
				container.style.position = 'absolute';
				container.style.left = '-9999px';
				container.style.top = '-9999px';
				document.body.appendChild(container);
				
				try {
					// Render the chart to SVG first
					const { svg } = await mermaid.render(chartId, chart.data);
					
					// Convert SVG to PNG using Canvas
					const pngBuffer = await this.svgToPng(svg, scale);
					
					// Store the PNG
					capturedCharts.set(chartName, pngBuffer);
					
					console.log(`[MermaidInternalPNGRenderer] Successfully rendered ${chartName} (${pngBuffer.length} bytes)`);
					
				} finally {
					// Clean up the container
					document.body.removeChild(container);
				}
				
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
		
		return capturedCharts;
	}
	
	private async svgToPng(svgString: string, scale: number): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			// Parse the SVG to get dimensions
			const parser = new DOMParser();
			const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
			const svgElement = svgDoc.documentElement as unknown as SVGSVGElement;
			
			// Get the viewBox or width/height
			let width = 800;
			let height = 600;
			
			if (svgElement.viewBox && svgElement.viewBox.baseVal) {
				width = svgElement.viewBox.baseVal.width;
				height = svgElement.viewBox.baseVal.height;
			} else if (svgElement.width && svgElement.height) {
				width = parseFloat(svgElement.width.baseVal.value.toString());
				height = parseFloat(svgElement.height.baseVal.value.toString());
			}
			
			// Apply scale
			width *= scale;
			height *= scale;
			
			// Create a canvas
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			
			if (!ctx) {
				reject(new Error('Could not get canvas context'));
				return;
			}
			
			// Create an image from the SVG
			const img = new Image();
			
			img.onload = () => {
				// Draw the image to canvas
				ctx.drawImage(img, 0, 0, width, height);
				
				// Convert to blob then to buffer
				canvas.toBlob((blob) => {
					if (!blob) {
						reject(new Error('Could not create blob from canvas'));
						return;
					}
					
					// Convert blob to buffer
					const reader = new FileReader();
					reader.onload = () => {
						const buffer = Buffer.from(reader.result as ArrayBuffer);
						resolve(buffer);
					};
					reader.onerror = () => reject(reader.error);
					reader.readAsArrayBuffer(blob);
				}, 'image/png');
			};
			
			img.onerror = (error) => {
				reject(new Error(`Failed to load SVG as image: ${error}`));
			};
			
			// Convert SVG string to data URL
			const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
			const svgUrl = URL.createObjectURL(svgBlob);
			
			// Load the image
			img.src = svgUrl;
			
			// Clean up the URL after a delay
			setTimeout(() => URL.revokeObjectURL(svgUrl), 1000);
		});
	}
}