import { filter, traverse } from "@atlaskit/adf-utils/traverse";
import { JSONDocNode } from "@atlaskit/editor-json-transformer";
import { ADFProcessingPlugin, PublisherFunctions } from "@markdown-confluence/lib";
import { ADFEntity } from "@atlaskit/adf-utils/types";
import SparkMD5 from "spark-md5";
import { MermaidRenderer, ChartData } from "@markdown-confluence/lib";

// Define UploadedImageData interface locally since it's not exported
interface UploadedImageData {
	collection: string;
	id: string;
	width?: number;
	height?: number;
}

function getMermaidFileNameSVG(mermaidContent: string | undefined) {
	const mermaidText = mermaidContent ?? "flowchart LR\nid1[Missing Chart]";
	const pathMd5 = SparkMD5.hash(mermaidText);
	const uploadFilename = `RenderedMermaidChart-${pathMd5}.svg`;
	return { uploadFilename, mermaidText };
}

export class SVGMermaidRendererPlugin
	implements
		ADFProcessingPlugin<
			ChartData[],
			Record<string, UploadedImageData | null>
		>
{
	constructor(private mermaidRenderer: MermaidRenderer) {}

	extract(adf: JSONDocNode): ChartData[] {
		const mermaidNodes = filter(
			adf,
			(node) =>
				node.type == "codeBlock" &&
				(node.attrs || {})?.["language"] === "mermaid",
		);

		const mermaidNodesToUpload = new Set(
			mermaidNodes.map((node) => {
				const mermaidDetails = getMermaidFileNameSVG(
					node?.content?.at(0)?.text,
				);
				return {
					name: mermaidDetails.uploadFilename,
					data: mermaidDetails.mermaidText,
				} as ChartData;
			}),
		);

		return Array.from(mermaidNodesToUpload);
	}

	async transform(
		mermaidNodesToUpload: ChartData[],
		supportFunctions: PublisherFunctions,
	): Promise<Record<string, UploadedImageData | null>> {
		let imageMap: Record<string, UploadedImageData | null> = {};
		if (mermaidNodesToUpload.length === 0) {
			return imageMap;
		}

		const mermaidChartsAsImages =
			await this.mermaidRenderer.captureMermaidCharts([
				...mermaidNodesToUpload,
			]);

		for (const mermaidImage of mermaidChartsAsImages) {
			const uploadedContent = await supportFunctions.uploadBuffer(
				mermaidImage[0],
				mermaidImage[1],
			);

			imageMap = {
				...imageMap,
				[mermaidImage[0]]: uploadedContent,
			};
		}

		return imageMap;
	}
	
	load(
		adf: JSONDocNode,
		imageMap: Record<string, UploadedImageData | null>,
	): JSONDocNode {
		let afterAdf = adf as ADFEntity;

		afterAdf =
			traverse(afterAdf, {
				codeBlock: (node, _parent) => {
					if (node?.attrs?.["language"] === "mermaid") {
						const mermaidContent = node?.content?.at(0)?.text;
						if (!mermaidContent) {
							return;
						}
						const mermaidFilename =
							getMermaidFileNameSVG(mermaidContent);

						if (!imageMap[mermaidFilename.uploadFilename]) {
							return;
						}
						const mappedImage =
							imageMap[mermaidFilename.uploadFilename];
						if (mappedImage) {
							node.type = "mediaSingle";
							node.attrs["layout"] = "center";
							if (node.content) {
								node.content = [
									{
										type: "media",
										attrs: {
											type: "file",
											collection: mappedImage.collection,
											id: mappedImage.id,
											width: mappedImage.width,
											height: mappedImage.height,
										},
									},
								];
							}
							delete node.attrs["language"];
							return node;
						}
					}
					return;
				},
			}) || afterAdf;

		return afterAdf as JSONDocNode;
	}
}