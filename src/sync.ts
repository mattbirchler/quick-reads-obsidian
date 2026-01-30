import { App, Notice, TFile, TFolder } from "obsidian";
import { QuickReadsApi } from "./api";
import {
	generateFilename,
	generateNoteContent,
	appendHighlightsToNote,
} from "./note-generator";
import {
	ApiHighlight,
	ArticleGroup,
	PluginData,
	QuickReadsSettings,
} from "./types";

export class SyncService {
	private app: App;
	private api: QuickReadsApi;
	private settings: QuickReadsSettings;
	private pluginData: PluginData;
	private savePluginData: () => Promise<void>;

	constructor(
		app: App,
		api: QuickReadsApi,
		settings: QuickReadsSettings,
		pluginData: PluginData,
		savePluginData: () => Promise<void>
	) {
		this.app = app;
		this.api = api;
		this.settings = settings;
		this.pluginData = pluginData;
		this.savePluginData = savePluginData;
	}

	updateSettings(settings: QuickReadsSettings) {
		this.settings = settings;
	}

	updatePluginData(pluginData: PluginData) {
		this.pluginData = pluginData;
	}

	async sync(): Promise<{ synced: number; errors: number }> {
		if (!this.settings.apiKey) {
			new Notice("Please configure your Quick Reads API key in settings");
			return { synced: 0, errors: 0 };
		}

		new Notice("Syncing highlights from Quick Reads...");

		try {
			// Fetch all highlights from API
			const allHighlights = await this.api.fetchAllHighlights();

			// Filter out already synced highlights
			const newHighlights = allHighlights.filter(
				(h) => !this.pluginData.syncedHighlightIds.includes(h.id)
			);

			if (newHighlights.length === 0) {
				new Notice("No new highlights to sync");
				this.pluginData.lastSyncTime = new Date().toISOString();
				await this.savePluginData();
				return { synced: 0, errors: 0 };
			}

			// Group highlights by article
			const articleMap = this.groupHighlightsByArticle(newHighlights);

			// Ensure folder exists
			await this.ensureFolder(this.settings.highlightsFolder);

			// Process each article
			let syncedCount = 0;
			let errorCount = 0;

			for (const articleGroup of articleMap.values()) {
				try {
					await this.processArticle(articleGroup);
					// Mark highlights as synced
					for (const h of articleGroup.highlights) {
						this.pluginData.syncedHighlightIds.push(h.id);
					}
					syncedCount += articleGroup.highlights.length;
				} catch (error) {
					console.error(
						`Error processing article ${articleGroup.articleId}:`,
						error
					);
					errorCount++;
				}
			}

			// Update last sync time and save
			this.pluginData.lastSyncTime = new Date().toISOString();
			await this.savePluginData();

			if (errorCount > 0) {
				new Notice(
					`Synced ${syncedCount} highlights with ${errorCount} errors`
				);
			} else {
				new Notice(`Successfully synced ${syncedCount} highlights`);
			}

			return { synced: syncedCount, errors: errorCount };
		} catch (error) {
			console.error("Sync failed:", error);
			new Notice(
				`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			return { synced: 0, errors: 1 };
		}
	}

	private groupHighlightsByArticle(
		highlights: ApiHighlight[]
	): Map<string, ArticleGroup> {
		const map = new Map<string, ArticleGroup>();

		for (const highlight of highlights) {
			const articleId = highlight.articleId;
			if (!map.has(articleId)) {
				map.set(articleId, {
					articleId: highlight.articleId,
					articleTitle: highlight.articleTitle,
					siteName: highlight.siteName,
					highlights: [],
				});
			}
			map.get(articleId)!.highlights.push(highlight);
		}

		// Sort highlights within each article by creation date
		for (const articleGroup of map.values()) {
			articleGroup.highlights.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() -
					new Date(b.createdAt).getTime()
			);
		}

		return map;
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`${folderPath} exists but is not a folder`);
		}
	}

	private async processArticle(articleGroup: ArticleGroup): Promise<void> {
		const filename = generateFilename(articleGroup);
		const filePath = `${this.settings.highlightsFolder}/${filename}.md`;

		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile instanceof TFile) {
			// Append to existing note
			const existingContent = await this.app.vault.read(existingFile);
			const updatedContent = appendHighlightsToNote(
				existingContent,
				articleGroup.highlights,
				new Date().toISOString()
			);
			await this.app.vault.modify(existingFile, updatedContent);
		} else {
			// Create new note
			const content = generateNoteContent(articleGroup);
			await this.app.vault.create(filePath, content);
		}
	}
}
