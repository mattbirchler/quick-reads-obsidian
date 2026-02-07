import {
	AbstractInputSuggest,
	App,
	PluginSettingTab,
	Setting,
	TFolder,
} from "obsidian";
import QuickReadsPlugin from "./main";

class FolderSuggest extends AbstractInputSuggest<TFolder> {
	getSuggestions(query: string): TFolder[] {
		const folders = this.app.vault.getAllFolders();
		const lower = query.toLowerCase();
		return folders
			.filter((f) => f.path.toLowerCase().includes(lower))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path || "/");
	}

	selectSuggestion(folder: TFolder): void {
		this.setValue(folder.path);
		this.close();
	}
}

export class QuickReadsSettingTab extends PluginSettingTab {
	plugin: QuickReadsPlugin;

	constructor(app: App, plugin: QuickReadsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Quick Reads Sync Settings" });

		new Setting(containerEl)
			.setName("API Key")
			.setDesc(
				"Your Quick Reads API key. Get it from quickreads.app/settings"
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Highlights Folder")
			.setDesc("Folder where highlight notes will be created")
			.addSearch((search) => {
				new FolderSuggest(this.app, search.inputEl).onSelect(
					async () => {
						const value = search.getValue();
						this.plugin.settings.highlightsFolder =
							value || "Quick Reads";
						await this.plugin.saveSettings();
					}
				);
				search
					.setPlaceholder("Quick Reads")
					.setValue(this.plugin.settings.highlightsFolder);
			});

		new Setting(containerEl)
			.setName("Sync on Startup")
			.setDesc("Automatically sync highlights when Obsidian starts")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.syncOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.syncOnStartup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-sync Interval")
			.setDesc(
				"Minutes between automatic syncs (0 to disable auto-sync)"
			)
			.addText((text) =>
				text
					.setPlaceholder("0")
					.setValue(String(this.plugin.settings.autoSyncInterval))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						this.plugin.settings.autoSyncInterval = isNaN(num)
							? 0
							: Math.max(0, num);
						await this.plugin.saveSettings();
						this.plugin.resetAutoSync();
					})
			);

		// Manual sync button
		new Setting(containerEl)
			.setName("Sync Now")
			.setDesc("Manually sync highlights from Quick Reads")
			.addButton((button) =>
				button.setButtonText("Sync").onClick(async () => {
					await this.plugin.syncHighlights();
				})
			);

		// Display last sync time and reset button
		const lastSync = this.plugin.pluginData.lastSyncTime;
		const resetSetting = new Setting(containerEl)
			.setName("Reset Sync")
			.setDesc(
				lastSync
					? `Last synced: ${new Date(lastSync).toLocaleString()}`
					: "Never synced"
			)
			.addButton((button) =>
				button
					.setButtonText("Reset")
					.setWarning()
					.onClick(async () => {
						this.plugin.pluginData.syncedHighlightIds = [];
						this.plugin.pluginData.lastSyncTime = null;
						await this.plugin.savePluginData();
						this.display(); // Refresh the settings view
					})
			);
	}
}
