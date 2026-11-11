import { MarkdownView, Plugin, type TFile } from 'obsidian';
import { t } from './i18n';
import { SizePickerModal } from './modal';
import {
	FM_ALIGN_KEY,
	FM_KEY,
	findFolderRule,
	folderPathOf,
	normalizeAlign,
	normalizeFolder,
	normalizeWidth,
	resolveAlign,
	resolveWidth,
} from './resolve';
import { ALIGNS, DEFAULT_SETTINGS, SETTINGS_SCHEMA } from './settings';
import { ImageSizeSettingTab } from './setting-tab';
import type { Align, PluginSettings, Scope, ScopeResolution } from './types';

export default class ImageSizePresetsPlugin extends Plugin {
	settings!: PluginSettings;

	private refreshTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon('image', t.ribbon, () => {
			this.openPicker();
		});

		this.addCommand({
			id: 'open-picker',
			name: t.commandOpen,
			callback: () => {
				this.openPicker();
			},
		});
		this.addCommand({
			id: 'pick-for-note',
			name: t.commandNote,
			callback: () => {
				this.openPicker('note');
			},
		});
		this.addCommand({
			id: 'pick-for-folder',
			name: t.commandFolder,
			callback: () => {
				this.openPicker('folder');
			},
		});

		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.scheduleRefresh(0)));
		this.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleRefresh(0)));
		this.registerEvent(this.app.workspace.on('file-open', () => this.scheduleRefresh(0)));
		this.registerEvent(this.app.metadataCache.on('changed', () => this.scheduleRefresh(120)));

		this.addSettingTab(new ImageSizeSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.refresh());
	}

	onunload(): void {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			this.clearPane(view.containerEl);
		}
	}

	async loadSettings(): Promise<void> {
		const loaded = ((await this.loadData()) ?? {}) as Partial<PluginSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
		if (!Array.isArray(this.settings.folderRules)) this.settings.folderRules = [];
		await this.migrate(loaded);
	}

	/**
	 * v1.0.x shipped a 900px height cap that binds before the width on tall
	 * images, which made the width control look broken. Turn it off for anyone
	 * still on the untouched default.
	 */
	private async migrate(loaded: Partial<PluginSettings>): Promise<void> {
		if (Number(loaded.schemaVersion ?? 0) >= SETTINGS_SCHEMA) return;
		if (Number(loaded.defaultHeight) === 900) this.settings.defaultHeight = 0;
		this.settings.schemaVersion = SETTINGS_SCHEMA;
		await this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	openPicker(scope?: Scope): void {
		new SizePickerModal(this.app, this, scope).open();
	}

	scheduleRefresh(delay: number): void {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refresh();
		}, delay);
	}

	/** Writes the caps, the override flag and the alignment onto each pane. */
	refresh(): void {
		const height = this.heightValue();
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			const el = view.containerEl;
			const file = view.file;
			if (!file) {
				this.clearPane(el);
				continue;
			}

			const cache = this.app.metadataCache.getFileCache(file);
			const folderPath = folderPathOf(file);
			const frontmatter = cache?.frontmatter ?? null;

			const resolved = resolveWidth({ frontmatter, folderPath, settings: this.settings });
			const align = resolveAlign({ frontmatter, folderPath, settings: this.settings });

			el.style.setProperty('--isp-width', resolved.width > 0 ? `${resolved.width}px` : '100%');
			el.style.setProperty('--isp-height', height);

			el.classList.toggle('isp-force', this.settings.overrideInlineWidth);
			for (const option of ALIGNS) el.classList.toggle(`isp-align-${option}`, align === option);
		}
	}

	private clearPane(el: HTMLElement): void {
		el.style.removeProperty('--isp-width');
		el.style.removeProperty('--isp-height');
		el.classList.remove('isp-force');
		for (const option of ALIGNS) el.classList.remove(`isp-align-${option}`);
	}

	effectiveWidthFor(file: TFile | null): ScopeResolution {
		if (!file) {
			const w = normalizeWidth(this.settings.defaultWidth);
			return { width: w === null ? DEFAULT_SETTINGS.defaultWidth : w, source: 'default' };
		}
		const cache = this.app.metadataCache.getFileCache(file);
		return resolveWidth({
			frontmatter: cache?.frontmatter ?? null,
			folderPath: folderPathOf(file),
			settings: this.settings,
		});
	}

	/** The value set on one specific layer; null when that layer is unset. */
	currentWidthFor(scope: Scope, file: TFile | null): ScopeResolution {
		if (scope === 'all') {
			const w = normalizeWidth(this.settings.defaultWidth);
			return { width: w === null ? DEFAULT_SETTINGS.defaultWidth : w, source: 'default' };
		}
		if (!file) return { width: null, source: 'unset' };
		if (scope === 'note') {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter ?? null;
			const w = normalizeWidth(frontmatter ? frontmatter[FM_KEY] : null);
			return w === null ? { width: null, source: 'unset' } : { width: w, source: 'note' };
		}
		const rule = findFolderRule(folderPathOf(file), this.settings.folderRules);
		if (!rule || rule.width === undefined) return { width: null, source: 'unset' };
		const w = normalizeWidth(rule.width);
		return w === null
			? { width: null, source: 'unset' }
			: { width: w, source: `folder:${normalizeFolder(rule.path)}` };
	}

	/** Same, for alignment. */
	currentAlignFor(scope: Scope, file: TFile | null): Align {
		if (scope === 'all') return this.settings.defaultAlign;
		if (!file) return 'inherit';
		if (scope === 'note') {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter ?? null;
			return normalizeAlign(frontmatter ? frontmatter[FM_ALIGN_KEY] : null) ?? 'inherit';
		}
		const rule = findFolderRule(folderPathOf(file), this.settings.folderRules);
		return (rule ? normalizeAlign(rule.align) : null) ?? 'inherit';
	}

	describeSource(result: ScopeResolution): string {
		if (result.source === 'note') return t.sourceNote;
		if (result.source === 'default') return t.sourceDefault;
		if (result.source === 'unset') return t.sourceUnset;
		const path = result.source.slice('folder:'.length);
		return path ? t.sourceFolder(path) : t.sourceRoot;
	}

	async setNoteWidth(file: TFile, width: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			fm[FM_KEY] = width > 0 ? width : 'none';
		});
		// Paint immediately: the metadata cache may not reflect the new
		// frontmatter yet, and waiting for it makes the picker feel dead.
		this.paintWidth(file.path, width);
		this.scheduleRefresh(150);
	}

	async setNoteAlign(file: TFile, align: Align): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			if (align === 'inherit') delete fm[FM_ALIGN_KEY];
			else fm[FM_ALIGN_KEY] = align;
		});
		this.paintAlign(file.path, align);
		this.scheduleRefresh(150);
	}

	/** The pane currently showing `path`, if any. */
	private paneFor(path: string): HTMLElement | null {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === path) return view.containerEl;
		}
		return null;
	}

	private paintWidth(path: string, width: number): void {
		const el = this.paneFor(path);
		if (el) el.style.setProperty('--isp-width', width > 0 ? `${width}px` : '100%');
	}

	private paintAlign(path: string, align: Align): void {
		const el = this.paneFor(path);
		if (!el) return;
		for (const option of ALIGNS) el.classList.toggle(`isp-align-${option}`, align === option);
	}

	async setFolderWidth(folderPath: string, width: number): Promise<void> {
		await this.upsertFolderRule(folderPath, (rule) => ({ ...rule, width }));
	}

	async setFolderAlign(folderPath: string, align: Align): Promise<void> {
		await this.upsertFolderRule(folderPath, (rule) => ({ ...rule, align }));
	}

	private async upsertFolderRule(
		folderPath: string,
		update: (rule: { path: string; width?: number; align?: Align }) => {
			path: string;
			width?: number;
			align?: Align;
		}
	): Promise<void> {
		const target = normalizeFolder(folderPath);
		const rules = this.settings.folderRules.slice();
		const index = rules.findIndex((rule) => normalizeFolder(rule.path) === target);
		if (index >= 0) rules[index] = update(rules[index]);
		else rules.push(update({ path: target }));
		this.settings.folderRules = rules;
		await this.saveSettings();
		this.scheduleRefresh(0);
	}

	async setGlobalWidth(width: number): Promise<void> {
		this.settings.defaultWidth = width;
		await this.saveSettings();
		this.scheduleRefresh(0);
	}

	async setGlobalAlign(align: Align): Promise<void> {
		this.settings.defaultAlign = align;
		await this.saveSettings();
		this.scheduleRefresh(0);
	}

	private heightValue(): string {
		const h = Number(this.settings.defaultHeight);
		return Number.isFinite(h) && h > 0 ? `${h}px` : 'none';
	}
}
