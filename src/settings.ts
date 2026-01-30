import { App, PluginSettingTab, Setting } from "obsidian";
import QuickReadsPlugin from "./main";

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
			.addText((text) =>
				text
					.setPlaceholder("Quick Reads")
					.setValue(this.plugin.settings.highlightsFolder)
					.onChange(async (value) => {
						this.plugin.settings.highlightsFolder =
							value || "Quick Reads";
						await this.plugin.saveSettings();
					})
			);

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

		// Display last sync time
		const lastSync = this.plugin.pluginData.lastSyncTime;
		if (lastSync) {
			const date = new Date(lastSync);
			containerEl.createEl("p", {
				text: `Last synced: ${date.toLocaleString()}`,
				cls: "setting-item-description",
			});
		}
	}
}
