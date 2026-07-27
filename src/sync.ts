import { App, Notice, TFile, TFolder } from "obsidian";
import { QuickReadsApi } from "./api";
import {
	generateFilename,
	generateNoteContent,
	appendHighlightsToNote,
	filterDuplicateHighlights,
	removeDuplicateHighlightBlocks,
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

	async sync(
		options: { silent?: boolean } = {}
	): Promise<{ synced: number; errors: number }> {
		const silent = options.silent ?? false;

		if (!this.settings.apiKey) {
			if (!silent) {
				new Notice(
					"Please configure your quick reads API key in settings"
				);
			}
			return { synced: 0, errors: 0 };
		}

		if (!silent) {
			new Notice("Syncing highlights from quick reads...");
		}

		try {
			// Fetch all highlights from API
			const allHighlights = await this.api.fetchAllHighlights();

			// Filter out already synced highlights
			const newHighlights = allHighlights.filter(
				(h) => !this.pluginData.syncedHighlightIds.includes(h.id)
			);

			if (newHighlights.length === 0) {
				if (!silent) {
					new Notice("No new highlights to sync");
				}
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
					// Persist after each article so an interrupted sync
					// doesn't re-append these highlights next time
					await this.savePluginData();
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

			// Silent (background) syncs only notify when something happened
			if (errorCount > 0) {
				new Notice(
					`Synced ${syncedCount} highlights with ${errorCount} errors`
				);
			} else if (!silent || syncedCount > 0) {
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
					author: highlight.author,
					url: highlight.url,
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

	async removeDuplicatesFromNotes(): Promise<{
		notesChanged: number;
		duplicatesRemoved: number;
	}> {
		const folder = this.app.vault.getAbstractFileByPath(
			this.settings.highlightsFolder
		);
		if (!(folder instanceof TFolder)) {
			new Notice(
				`Highlights folder "${this.settings.highlightsFolder}" not found`
			);
			return { notesChanged: 0, duplicatesRemoved: 0 };
		}

		let notesChanged = 0;
		let duplicatesRemoved = 0;

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") {
				continue;
			}
			const content = await this.app.vault.read(child);
			const result = removeDuplicateHighlightBlocks(content);
			if (result.removed > 0 && result.content !== content) {
				await this.app.vault.modify(child, result.content);
				notesChanged++;
				duplicatesRemoved += result.removed;
			}
		}

		return { notesChanged, duplicatesRemoved };
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
			// Append to existing note, skipping highlights already present
			const existingContent = await this.app.vault.read(existingFile);
			const newHighlights = filterDuplicateHighlights(
				existingContent,
				articleGroup.highlights
			);
			if (newHighlights.length > 0) {
				const updatedContent = appendHighlightsToNote(
					existingContent,
					newHighlights
				);
				await this.app.vault.modify(existingFile, updatedContent);
			}
		} else {
			// Create new note, deduping within the batch
			const dedupedGroup = {
				...articleGroup,
				highlights: filterDuplicateHighlights(
					"",
					articleGroup.highlights
				),
			};
			const content = generateNoteContent(dedupedGroup, this.settings);
			await this.app.vault.create(filePath, content);
		}
	}
}
