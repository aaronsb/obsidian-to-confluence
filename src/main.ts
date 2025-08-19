import { Plugin, Notice, MarkdownView, Workspace, loadMermaid } from "obsidian";
import {
	ConfluenceUploadSettings,
	Publisher,
	ConfluencePageConfig,
	StaticSettingsLoader,
	renderADFDoc,
	MermaidRendererPlugin,
	UploadAdfFileResult,
} from "@markdown-confluence/lib";
import { ElectronMermaidRenderer } from "@markdown-confluence/mermaid-electron-renderer";
import { SVGMermaidRenderer } from "./SVGMermaidRenderer";
import { MermaidCLIRenderer } from "./MermaidCLIRenderer";
import { SVGMermaidRendererPlugin } from "./SVGMermaidRendererPlugin";
import { ConfluenceSettingTab } from "./ConfluenceSettingTab";
import ObsidianAdaptor from "./adaptors/obsidian";
import { CompletedModal } from "./CompletedModal";
import { ObsidianConfluenceClient } from "./MyBaseClient";
import {
	ConfluencePerPageForm,
	ConfluencePerPageUIValues,
	mapFrontmatterToConfluencePerPageUIValues,
} from "./ConfluencePerPageForm";
import { Mermaid } from "mermaid";

export interface ObsidianPluginSettings
	extends ConfluenceUploadSettings.ConfluenceSettings {
	mermaidImageFormat?: "svg" | "png";  // Default to SVG for better quality
}

interface FailedFile {
	fileName: string;
	reason: string;
}

interface UploadResults {
	errorMessage: string | null;
	failedFiles: FailedFile[];
	filesUploadResult: UploadAdfFileResult[];
}

export default class ConfluencePlugin extends Plugin {
	settings!: ObsidianPluginSettings;
	private isSyncing = false;
	workspace!: Workspace;
	publisher!: Publisher;
	adaptor!: ObsidianAdaptor;

	activeLeafPath(workspace: Workspace) {
		const activeView = workspace.getActiveViewOfType(MarkdownView);
		if (activeView && activeView.file) {
			console.log("Active file path:", activeView.file.path);
			return activeView.file.path;
		}
		console.log("No active markdown file found");
		return undefined;
	}

	async init() {
		await this.loadSettings();
		const { vault, metadataCache, workspace } = this.app;
		this.workspace = workspace;
		this.adaptor = new ObsidianAdaptor(
			vault,
			metadataCache,
			this.settings,
			this.app,
		);

		const mermaidItems = await this.getMermaidItems();
		
		// Choose renderer based on user preference (default to SVG for better quality)
		const useSVG = this.settings.mermaidImageFormat !== "png";
		
		// Create the appropriate renderer
		let mermaidRenderer;
		let mermaidPlugin;
		
		if (useSVG) {
			// Use CLI renderer for SVG (more reliable than Obsidian's internal mermaid)
			mermaidRenderer = new MermaidCLIRenderer();
			// Use our custom SVG-aware plugin
			mermaidPlugin = new SVGMermaidRendererPlugin(mermaidRenderer);
		} else {
			// Use Electron renderer for PNG
			mermaidRenderer = new ElectronMermaidRenderer(
				mermaidItems.extraStyleSheets,
				mermaidItems.extraStyles,
				mermaidItems.mermaidConfig,
				mermaidItems.bodyStyles
			);
			// Use the standard plugin for PNG
			mermaidPlugin = new MermaidRendererPlugin(mermaidRenderer);
		}
		
		console.log("Using Mermaid renderer:", useSVG ? "SVG (CLI)" : "PNG (Electron)");
		
		console.log("Initializing Confluence client with:", {
			host: this.settings.confluenceBaseUrl,
			email: this.settings.atlassianUserName,
			hasApiToken: !!this.settings.atlassianApiToken
		});
		
		const confluenceClient = new ObsidianConfluenceClient({
			host: this.settings.confluenceBaseUrl,
			authentication: {
				basic: {
					email: this.settings.atlassianUserName,
					apiToken: this.settings.atlassianApiToken,
				},
			},
			middlewares: {
				onError(e) {
					console.error("Confluence API Error:", e);
					if ("response" in e && e.response && "data" in e.response) {
						e.message =
							typeof e.response.data === "string"
								? e.response.data
								: JSON.stringify(e.response.data);
					}
				},
			},
		});

		const settingsLoader = new StaticSettingsLoader(this.settings);
		this.publisher = new Publisher(
			this.adaptor,
			settingsLoader,
			confluenceClient,
			[mermaidPlugin],
		);
	}

	async getMermaidItems() {
		// Simplified - no theme customization for Confluence compatibility
		// Custom themes generate color formats (hsl, rgb) that Confluence can't render
		const extraStyles: string[] = [];
		const extraStyleSheets: string[] = [];
		const bodyStyles = "";

		// For PNG rendering only - add Obsidian styles
		extraStyleSheets.push("app://obsidian.md/app.css");

		// Get the default mermaid config - used only for PNG rendering
		const defaultConfig = ((await loadMermaid()) as Mermaid).mermaidAPI.getConfig();

		return {
			extraStyleSheets,
			extraStyles,
			mermaidConfig: defaultConfig,  // Default config only, no custom themes
			bodyStyles,
		};
	}

	async doPublish(publishFilter?: string): Promise<UploadResults> {
		console.log("Starting publish with filter:", publishFilter);
		console.log("Settings:", {
			baseUrl: this.settings.confluenceBaseUrl,
			userName: this.settings.atlassianUserName,
			hasApiToken: !!this.settings.atlassianApiToken,
			folderToPublish: this.settings.folderToPublish,
			confluenceParentId: this.settings.confluenceParentId
		});
		
		// If a specific file is provided, ensure it's passed correctly
		if (publishFilter) {
			console.log("Publishing specific file:", publishFilter);
		} else if (this.settings.folderToPublish) {
			console.log("Publishing folder:", this.settings.folderToPublish);
		} else {
			console.log("Warning: No specific file or folder to publish configured");
		}
		
		const adrFiles = await this.publisher.publish(publishFilter);

		const returnVal: UploadResults = {
			errorMessage: null,
			failedFiles: [],
			filesUploadResult: [],
		};

		adrFiles.forEach((element) => {
			if (element.successfulUploadResult) {
				returnVal.filesUploadResult.push(
					element.successfulUploadResult,
				);
				return;
			}

			returnVal.failedFiles.push({
				fileName: element.node.file.absoluteFilePath,
				reason: element.reason ?? "No Reason Provided",
			});
		});

		return returnVal;
	}

	override async onload() {
		await this.init();

		this.addRibbonIcon("cloud", "Publish to Confluence", async () => {
			if (this.isSyncing) {
				new Notice("Syncing already on going");
				return;
			}
			
			// Check if folder to publish is configured
			if (!this.settings.folderToPublish) {
				new Notice("Please configure 'Folder to Publish' in plugin settings");
				return;
			}
			
			this.isSyncing = true;
			try {
				const stats = await this.doPublish();
				new CompletedModal(this.app, {
					uploadResults: stats,
				}).open();
			} catch (error) {
				if (error instanceof Error) {
					new CompletedModal(this.app, {
						uploadResults: {
							errorMessage: error.message,
							failedFiles: [],
							filesUploadResult: [],
						},
					}).open();
				} else {
					new CompletedModal(this.app, {
						uploadResults: {
							errorMessage: JSON.stringify(error),
							failedFiles: [],
							filesUploadResult: [],
						},
					}).open();
				}
			} finally {
				this.isSyncing = false;
			}
		});

		this.addCommand({
			id: "adf-to-markdown",
			name: "ADF To Markdown",
			callback: async () => {
				console.log("HMMMM");
				const json = JSON.parse(
					'{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Testing","type":"text"}]}],"version":1}',
				);
				console.log({ json });

				const confluenceClient = new ObsidianConfluenceClient({
					host: this.settings.confluenceBaseUrl,
					authentication: {
						basic: {
							email: this.settings.atlassianUserName,
							apiToken: this.settings.atlassianApiToken,
						},
					},
				});
				const testingPage =
					await confluenceClient.content.getContentById({
						id: "9732097",
						expand: ["body.atlas_doc_format", "space"],
					});
				const adf = JSON.parse(
					testingPage.body?.atlas_doc_format?.value ||
						'{type: "doc", content:[]}',
				);
				renderADFDoc(adf);
			},
		});

		this.addCommand({
			id: "publish-current",
			name: "Publish Current File to Confluence",
			checkCallback: (checking: boolean) => {
				if (!this.isSyncing) {
					if (!checking) {
						const currentPath = this.activeLeafPath(this.workspace);
						if (!currentPath) {
							new Notice("No active markdown file to publish");
							return false;
						}
						this.isSyncing = true;
						this.doPublish(currentPath)
							.then((stats) => {
								new CompletedModal(this.app, {
									uploadResults: stats,
								}).open();
							})
							.catch((error) => {
								if (error instanceof Error) {
									new CompletedModal(this.app, {
										uploadResults: {
											errorMessage: error.message,
											failedFiles: [],
											filesUploadResult: [],
										},
									}).open();
								} else {
									new CompletedModal(this.app, {
										uploadResults: {
											errorMessage: JSON.stringify(error),
											failedFiles: [],
											filesUploadResult: [],
										},
									}).open();
								}
							})
							.finally(() => {
								this.isSyncing = false;
							});
					}
					return true;
				}
				return true;
			},
		});

		this.addCommand({
			id: "publish-all",
			name: "Publish All to Confluence",
			checkCallback: (checking: boolean) => {
				if (!this.isSyncing) {
					if (!checking) {
						// Check if folder to publish is configured
						if (!this.settings.folderToPublish) {
							new Notice("Please configure 'Folder to Publish' in plugin settings");
							return false;
						}
						this.isSyncing = true;
						this.doPublish()
							.then((stats) => {
								new CompletedModal(this.app, {
									uploadResults: stats,
								}).open();
							})
							.catch((error) => {
								if (error instanceof Error) {
									new CompletedModal(this.app, {
										uploadResults: {
											errorMessage: error.message,
											failedFiles: [],
											filesUploadResult: [],
										},
									}).open();
								} else {
									new CompletedModal(this.app, {
										uploadResults: {
											errorMessage: JSON.stringify(error),
											failedFiles: [],
											filesUploadResult: [],
										},
									}).open();
								}
							})
							.finally(() => {
								this.isSyncing = false;
							});
					}
				}
				return true;
			},
		});

		this.addCommand({
			id: "enable-publishing",
			name: "Enable publishing to Confluence",
			editorCheckCallback: (checking, _editor, view) => {
				if (!view.file) {
					return false;
				}

				if (checking) {
					const frontMatter = this.app.metadataCache.getCache(
						view.file.path,
					)?.frontmatter;
					const file = view.file;
					const enabledForPublishing =
						(file.path.startsWith(this.settings.folderToPublish) &&
							(!frontMatter ||
								frontMatter["connie-publish"] !== false)) ||
						(frontMatter && frontMatter["connie-publish"] === true);
					return !enabledForPublishing;
				}

				this.app.fileManager.processFrontMatter(
					view.file,
					(frontmatter) => {
						if (
							view.file &&
							view.file.path.startsWith(
								this.settings.folderToPublish,
							)
						) {
							delete frontmatter["connie-publish"];
						} else {
							frontmatter["connie-publish"] = true;
						}
					},
				);
				return true;
			},
		});

		this.addCommand({
			id: "disable-publishing",
			name: "Disable publishing to Confluence",
			editorCheckCallback: (checking, _editor, view) => {
				if (!view.file) {
					return false;
				}

				if (checking) {
					const frontMatter = this.app.metadataCache.getCache(
						view.file.path,
					)?.frontmatter;
					const file = view.file;
					const enabledForPublishing =
						(file.path.startsWith(this.settings.folderToPublish) &&
							(!frontMatter ||
								frontMatter["connie-publish"] !== false)) ||
						(frontMatter && frontMatter["connie-publish"] === true);
					return enabledForPublishing;
				}

				this.app.fileManager.processFrontMatter(
					view.file,
					(frontmatter) => {
						if (
							view.file &&
							view.file.path.startsWith(
								this.settings.folderToPublish,
							)
						) {
							frontmatter["connie-publish"] = false;
						} else {
							delete frontmatter["connie-publish"];
						}
					},
				);
				return true;
			},
		});

		this.addCommand({
			id: "page-settings",
			name: "Update Confluence Page Settings",
			editorCallback: (_editor, view) => {
				if (!view.file) {
					return false;
				}

				const frontMatter = this.app.metadataCache.getCache(
					view.file.path,
				)?.frontmatter;

				const file = view.file;

				new ConfluencePerPageForm(this.app, {
					config: ConfluencePageConfig.conniePerPageConfig,
					initialValues:
						mapFrontmatterToConfluencePerPageUIValues(frontMatter),
					onSubmit: (values, close) => {
						const valuesToSet: Partial<ConfluencePageConfig.ConfluencePerPageAllValues> =
							{};
						for (const propertyKey in values) {
							if (
								Object.prototype.hasOwnProperty.call(
									values,
									propertyKey,
								)
							) {
								const element =
									values[
										propertyKey as keyof ConfluencePerPageUIValues
									];
								if (element.isSet) {
									valuesToSet[
										propertyKey as keyof ConfluencePerPageUIValues
									] = element.value as never;
								}
							}
						}
						this.adaptor.updateMarkdownValues(
							file.path,
							valuesToSet,
						);
						close();
					},
				}).open();
				return true;
			},
		});

		this.addSettingTab(new ConfluenceSettingTab(this.app, this));
	}

	override async onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			ConfluenceUploadSettings.DEFAULT_SETTINGS,
			{ 
				mermaidImageFormat: "svg"  // Default to SVG for better quality
			},
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.init();
	}
}
