import { ChartData, MermaidRenderer } from "@markdown-confluence/lib";
import { MermaidConfig } from "mermaid";
import { loadMermaid } from "obsidian";

export class SVGMermaidRenderer implements MermaidRenderer {
	private mermaidConfig: MermaidConfig;

	constructor(mermaidConfig?: MermaidConfig) {
		this.mermaidConfig = mermaidConfig || {};
	}

	async captureMermaidCharts(charts: ChartData[]): Promise<Map<string, Buffer>> {
		const capturedCharts = new Map<string, Buffer>();
		
		// Load Mermaid from Obsidian
		const mermaid = (await loadMermaid()) as any;
		
		// Initialize mermaid with our config
		mermaid.initialize({ 
			...this.mermaidConfig, 
			startOnLoad: false 
		});
		
		// If we have theme variables, update the config
		if (this.mermaidConfig.themeVariables) {
			mermaid.mermaidAPI.updateSiteConfig({ 
				themeVariables: this.mermaidConfig.themeVariables 
			});
		}

		// Process each chart
		for (const chart of charts) {
			try {
				// Generate unique ID for the chart
				const id = "mermaid-" + Math.random().toString(36).substr(2, 9);
				
				// Render the chart to SVG
				const { svg } = await mermaid.render(id, chart.data);
				
				// Clean up the SVG
				let cleanedSvg = svg;
				
				// Remove any background styles that might have been added
				cleanedSvg = cleanedSvg.replace(/style="[^"]*background[^"]*"/gi, 'style=""');
				
				// Ensure SVG has transparent background
				cleanedSvg = cleanedSvg.replace(
					/<svg/,
					'<svg style="background: transparent"'
				);
				
				// Add XML declaration for better compatibility
				const fullSvg = '<?xml version="1.0" encoding="UTF-8"?>\n' + cleanedSvg;
				
				// Convert SVG string to Buffer
				const svgBuffer = Buffer.from(fullSvg, 'utf-8');
				
				// Store with the original chart name (Publisher expects exact name)
				capturedCharts.set(chart.name, svgBuffer);
				
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

		return capturedCharts;
	}
}