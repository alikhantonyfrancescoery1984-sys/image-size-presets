import { MarkdownView, Plugin, type TFile } from 'obsidian';
import { t } from './i18n';
import { SizePickerModal } from './modal';
import { FM_KEY, findFolderRule, folderPathOf, normalizeFolder, normalizeWidth, resolveWidth } from './resolve';
import { DEFAULT_SETTINGS } from './settings';
import { ImageSizeSettingTab } from './setting-tab';
import type { PluginSettings, Scope, ScopeResolution } from './types';

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
			view.containerEl.style.removeProperty('--isp-width');
			view.containerEl.style.removeProperty('--isp-height');
		}
	}

	async loadSettings(): Promise<void> {
		const loaded = ((await this.loadData()) ?? {}) as Partial<PluginSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
		if (!Array.isArray(this.settings.folderRules)) this.settings.folderRules = [];
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

	/** Writes the caps onto each markdown pane as CSS custom properties. */
	refresh(): void {
		const height = this.heightValue();
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			const el = view.containerEl;
			const file = view.file;
			if (!file) {
				el.style.removeProperty('--isp-width');
				el.style.removeProperty('--isp-height');
				continue;
			}
			const cache = this.app.metadataCache.getFileCache(file);
			const resolved = resolveWidth({
				frontmatter: cache?.frontmatter ?? null,
				folderPath: folderPathOf(file),
				settings: this.settings,
			});
			el.style.setProperty('--isp-width', resolved.width > 0 ? `${resolved.width}px` : '100%');
			el.style.setProperty('--isp-height', height);
		}
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
		if (!rule) return { width: null, source: 'unset' };
		const w = normalizeWidth(rule.width);
		return w === null
			? { width: null, source: 'unset' }
			: { width: w, source: `folder:${normalizeFolder(rule.path)}` };
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
		this.scheduleRefresh(80);
	}

	async setFolderWidth(folderPath: string, width: number): Promise<void> {
		const target = normalizeFolder(folderPath);
		const rules = this.settings.folderRules.filter((rule) => normalizeFolder(rule.path) !== target);
		rules.push({ path: target, width });
		this.settings.folderRules = rules;
		await this.saveSettings();
		this.scheduleRefresh(0);
	}

	async setGlobalWidth(width: number): Promise<void> {
		this.settings.defaultWidth = width;
		await this.saveSettings();
		this.scheduleRefresh(0);
	}

	private heightValue(): string {
		const h = Number(this.settings.defaultHeight);
		return Number.isFinite(h) && h > 0 ? `${h}px` : 'none';
	}
}
