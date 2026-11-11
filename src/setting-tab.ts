import { App, PluginSettingTab, Setting } from 'obsidian';
import { t } from './i18n';
import { normalizeAlign, normalizeFolder, normalizeLayout } from './resolve';
import type ImageSizePresetsPlugin from './main';
import type { Align } from './types';

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
			.setName(t.overrideLabel)
			.setDesc(t.overrideDesc)
			.addToggle((toggle) =>
				toggle.setValue(settings.overrideInlineWidth).onChange(async (value) => {
					settings.overrideInlineWidth = value;
					await this.plugin.saveSettings();
					this.plugin.scheduleRefresh(0);
				})
			);

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

		new Setting(containerEl)
			.setName(t.defaultAlignLabel)
			.setDesc(t.defaultAlignDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						inherit: t.align.inherit,
						left: t.align.left,
						center: t.align.center,
						right: t.align.right,
					})
					.setValue(settings.defaultAlign)
					.onChange(async (value) => {
						settings.defaultAlign = normalizeAlign(value) ?? 'inherit';
						await this.plugin.saveSettings();
						this.plugin.scheduleRefresh(0);
					})
			);

		new Setting(containerEl)
			.setName(t.defaultLayoutLabel)
			.setDesc(t.defaultLayoutDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						stack: t.layout.stack,
						cols2: t.layout.cols2,
						cols3: t.layout.cols3,
					})
					.setValue(settings.defaultLayout)
					.onChange(async (value) => {
						settings.defaultLayout = normalizeLayout(value) ?? 'stack';
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
			const width = rule.width === undefined ? null : Number(rule.width);
			const align = normalizeAlign(rule.align) ?? 'inherit';
			const layout = normalizeLayout(rule.layout) ?? 'stack';
			const details = [
				width === null ? t.followDefault : width > 0 ? `${width}px` : t.noLimit,
				layout === 'stack' ? null : t.layout[layout],
				align === 'inherit' ? null : t.align[align as Align],
			].filter((part): part is string => part !== null);

			new Setting(containerEl)
				.setName(path || t.rootFolder)
				.setDesc(details.join(' · '))
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
