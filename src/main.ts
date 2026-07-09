import { Notice, Plugin } from "obsidian";
import { QuickReadsApi } from "./api";
import { QuickReadsSettingTab } from "./settings";
import { SyncService } from "./sync";
import {
	DEFAULT_PLUGIN_DATA,
	DEFAULT_SETTINGS,
	PluginData,
	QuickReadsSettings,
} from "./types";

export default class QuickReadsPlugin extends Plugin {
	settings: QuickReadsSettings = DEFAULT_SETTINGS;
	pluginData: PluginData = DEFAULT_PLUGIN_DATA;
	private api: QuickReadsApi = new QuickReadsApi("");
	private syncService: SyncService | null = null;
	private autoSyncIntervalId: number | null = null;

	async onload() {
		await this.loadSettings();

		this.api = new QuickReadsApi(this.settings.apiKey);
		this.syncService = new SyncService(
			this.app,
			this.api,
			this.settings,
			this.pluginData,
			() => this.savePluginData()
		);

		// Add ribbon icon
		this.addRibbonIcon("book-open", "Sync quick reads highlights", () => {
			void this.syncHighlights();
		});

		// Add command
		this.addCommand({
			id: "sync-highlights",
			name: "Sync highlights from quick reads",
			callback: () => {
				void this.syncHighlights();
			},
		});

		this.addCommand({
			id: "remove-duplicate-highlights",
			name: "Remove duplicate highlights from synced notes",
			callback: () => {
				void this.removeDuplicateHighlights();
			},
		});

		// Add settings tab
		this.addSettingTab(new QuickReadsSettingTab(this.app, this));

		// Setup auto-sync
		this.setupAutoSync();

		// Sync on startup if enabled
		if (this.settings.syncOnStartup && this.settings.apiKey) {
			// Delay startup sync slightly to let Obsidian fully load
			window.setTimeout(() => {
				void this.syncHighlights();
			}, 2000);
		}
	}

	onunload() {
		this.clearAutoSync();
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<PluginData> | null;
		if (data) {
			this.pluginData = {
				...DEFAULT_PLUGIN_DATA,
				...data,
				settings: {
					...DEFAULT_SETTINGS,
					...data.settings,
				},
			};
			this.settings = this.pluginData.settings;
		}
	}

	async saveSettings() {
		this.pluginData.settings = this.settings;
		await this.saveData(this.pluginData);
		this.api.setApiKey(this.settings.apiKey);
		if (this.syncService) {
			this.syncService.updateSettings(this.settings);
		}
	}

	async savePluginData() {
		await this.saveData(this.pluginData);
		if (this.syncService) {
			this.syncService.updatePluginData(this.pluginData);
		}
	}

	async syncHighlights() {
		if (this.syncService) {
			await this.syncService.sync();
		}
	}

	async removeDuplicateHighlights() {
		if (!this.syncService) {
			return;
		}
		const result = await this.syncService.removeDuplicatesFromNotes();
		if (result.duplicatesRemoved > 0) {
			new Notice(
				`Removed ${result.duplicatesRemoved} duplicate highlight${
					result.duplicatesRemoved === 1 ? "" : "s"
				} across ${result.notesChanged} note${
					result.notesChanged === 1 ? "" : "s"
				}`
			);
		} else {
			new Notice("No duplicate highlights found");
		}
	}

	setupAutoSync() {
		this.clearAutoSync();

		if (this.settings.autoSyncInterval > 0) {
			const intervalMs = this.settings.autoSyncInterval * 60 * 1000;
			this.autoSyncIntervalId = window.setInterval(() => {
				void this.syncHighlights();
			}, intervalMs);

			// Register interval for cleanup
			this.registerInterval(this.autoSyncIntervalId);
		}
	}

	clearAutoSync() {
		if (this.autoSyncIntervalId !== null) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
		}
	}

	resetAutoSync() {
		this.setupAutoSync();
	}
}
