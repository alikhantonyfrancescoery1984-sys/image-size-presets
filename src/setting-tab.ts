import { App, PluginSettingTab, Setting } from 'obsidian';
import { t } from './i18n';
import { normalizeFolder } from './resolve';
import type ImageSizePresetsPlugin from './main';

export class ImageSizeSettingTab extends PluginSettingTab {
	private readonly plugin: ImageSizePresetsPlugin;

	constructor(app: App, plugin: ImageSizePresetsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.settings;

		containerEl.empty();
		containerEl.addClass('isp-settings');

		new Setting(containerEl).setName(t.settingsTitle).setHeading();
		containerEl.createEl('p', { cls: 'isp-hint', text: t.settingsDesc });

		new Setting(containerEl)
			.setName(t.defaultWidth)
			.setDesc(t.defaultWidthDesc)
			.addSlider((slider) =>
				slider
					.setLimits(0, 1600, 20)
					.setValue(Math.max(0, Number(settings.defaultWidth) || 0))
					.onChange(async (value) => {
						settings.defaultWidth = value;
						await this.plugin.saveSettings();
						this.plugin.scheduleRefresh(0);
					})
			);

		new Setting(containerEl)
			.setName(t.defaultHeight)
			.setDesc(t.defaultHeightDesc)
			.addSlider((slider) =>
				slider
					.setLimits(0, 2400, 20)
					.setValue(Math.max(0, Number(settings.defaultHeight) || 0))
					.onChange(async (value) => {
						settings.defaultHeight = value;
						await this.plugin.saveSettings();
						this.plugin.scheduleRefresh(0);
					})
			);

		new Setting(containerEl).setName(t.folderRules).setHeading();

		const rules = Array.isArray(settings.folderRules) ? settings.folderRules : [];
		if (rules.length === 0) {
			containerEl.createEl('p', { cls: 'isp-hint', text: t.folderRulesEmpty });
		}

		for (const rule of rules.slice()) {
			const path = normalizeFolder(rule.path);
			const width = Number(rule.width);
			new Setting(containerEl)
				.setName(path || t.rootFolder)
				.setDesc(width > 0 ? `${width}px` : t.noLimit)
				.addButton((button) =>
					button
						.setButtonText(t.ruleDelete)
						.setClass('mod-warning')
						.onClick(async () => {
							settings.folderRules = settings.folderRules.filter((item) => item !== rule);
							await this.plugin.saveSettings();
							this.plugin.scheduleRefresh(0);
							this.display();
						})
				);
		}
	}
}
