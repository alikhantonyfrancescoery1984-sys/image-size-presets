import { MarkdownView, Plugin, type TFile } from 'obsidian';
import { t } from './i18n';
import { SizePickerModal } from './modal';
import { computePaneState, paneStateKey } from './pane-state';
import type { PaneState } from './pane-state';
import {
	FM_ALIGN_KEY,
	FM_KEY,
	FM_LAYOUT_KEY,
	findFolderRule,
	folderPathOf,
	normalizeAlign,
	normalizeFolder,
	normalizeLayout,
	normalizeWidth,
	resolveAlign,
	resolveWidth,
} from './resolve';
import { ALIGNS, DEFAULT_SETTINGS, SETTINGS_SCHEMA } from './settings';
import { ImageSizeSettingTab } from './setting-tab';
import { joinAdjacentImageLines } from './tidy';
import type { Align, Layout, PluginSettings, Scope, ScopeResolution } from './types';

/** How long our own frontmatter write may take to reach the metadata cache. */
const PENDING_MS = 500;

export default class ImageSizePresetsPlugin extends Plugin {
	settings!: PluginSettings;

	private refreshTimer: number | null = null;

	/** Last state applied to each pane, so unchanged panes are left alone. */
	private lastState = new WeakMap<HTMLElement, string>();

	/** Panes we painted ourselves and must not revert until the cache agrees. */
	private pendingUntil = new Map<string, number>();

	/** Retries while a pane's metadata cache is still unreadable. */
	private retryTimer: number | null = null;

	private retries = 0;

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
		// Fires once the initial index is built; without it a pane opened during
		// startup could keep the "cache not ready" state forever.
		this.registerEvent(this.app.metadataCache.on('resolved', () => this.scheduleRefresh(0)));

		this.addSettingTab(new ImageSizeSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.refresh());
	}

	onunload(): void {
		if (this.refreshTimer !== null) {
			window.clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}
		if (this.retryTimer !== null) {
			window.clearTimeout(this.retryTimer);
			this.retryTimer = null;
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

	/** Writes the caps, the override flag, the layout and the alignment onto each pane. */
	refresh(): void {
		const now = Date.now();
		let retryNeeded = false;
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			const el = view.containerEl;
			const file = view.file;
			if (!file) {
				this.clearPane(el);
				continue;
			}

			// Our own frontmatter write has not reached the cache yet. The
			// optimistic paint is already right, so leave the pane alone
			// rather than reverting it to the value we just replaced.
			const pendingUntil = this.pendingUntil.get(file.path);
			if (pendingUntil !== undefined) {
				if (now < pendingUntil) continue;
				this.pendingUntil.delete(file.path);
			}

			const cache = this.app.metadataCache.getFileCache(file);
			const state = computePaneState({
				frontmatter: cache?.frontmatter ?? null,
				cacheReady: cache !== null,
				folderPath: folderPathOf(file),
				settings: this.settings,
			});
			// null means the metadata cache is mid-rebuild: touching the pane
			// now would resize images and force a re-decode. Come back shortly.
			if (!state) {
				retryNeeded = true;
				continue;
			}

			const key = paneStateKey(state);
			if (this.lastState.get(el) === key) continue;

			this.applyPaneState(el, state);
			this.lastState.set(el, key);
		}

		if (retryNeeded) this.scheduleRetry();
		else this.retries = 0;
	}

	/**
	 * A pane whose metadata cache is unreadable must not stay unstyled: the
	 * images would keep their inline widths and look "not applied". Retry with
	 * a bound so a permanently unreadable file cannot spin forever.
	 */
	private scheduleRetry(): void {
		if (this.retries >= 10) return;
		this.retries += 1;
		if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
		this.retryTimer = window.setTimeout(() => {
			this.retryTimer = null;
			this.refresh();
		}, 200);
	}

	private applyPaneState(el: HTMLElement, state: PaneState): void {
		el.style.setProperty('--isp-width', state.width);
		el.style.setProperty('--isp-height', state.height);
		el.classList.toggle('isp-force', state.force);
		el.classList.toggle('isp-layout-cols2', state.layout === 'cols2');
		el.classList.toggle('isp-layout-cols3', state.layout === 'cols3');
		for (const option of ALIGNS) el.classList.toggle(`isp-align-${option}`, state.align === option);
	}

	private clearPane(el: HTMLElement): void {
		this.lastState.delete(el);
		el.style.removeProperty('--isp-width');
		el.style.removeProperty('--isp-height');
		el.classList.remove('isp-force');
		el.classList.remove('isp-layout-cols2');
		el.classList.remove('isp-layout-cols3');
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

	/** Same, for layout. */
	currentLayoutFor(scope: Scope, file: TFile | null): Layout {
		if (scope === 'all') return this.settings.defaultLayout;
		if (!file) return 'stack';
		if (scope === 'note') {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter ?? null;
			return normalizeLayout(frontmatter ? frontmatter[FM_LAYOUT_KEY] : null) ?? 'stack';
		}
		const rule = findFolderRule(folderPathOf(file), this.settings.folderRules);
		return (rule ? normalizeLayout(rule.layout) : null) ?? 'stack';
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
		this.pendingUntil.set(file.path, Date.now() + PENDING_MS);
		this.paintWidth(file.path, width);
		this.scheduleRefresh(PENDING_MS + 50);
	}

	async setNoteAlign(file: TFile, align: Align): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			if (align === 'inherit') delete fm[FM_ALIGN_KEY];
			else fm[FM_ALIGN_KEY] = align;
		});
		this.pendingUntil.set(file.path, Date.now() + PENDING_MS);
		this.paintAlign(file.path, align);
		this.scheduleRefresh(PENDING_MS + 50);
	}

	async setNoteLayout(file: TFile, layout: Layout): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			if (layout === 'stack') delete fm[FM_LAYOUT_KEY];
			else fm[FM_LAYOUT_KEY] = layout === 'cols2' ? 2 : 3;
		});
		this.pendingUntil.set(file.path, Date.now() + PENDING_MS);
		this.paintLayout(file.path, layout);
		this.scheduleRefresh(PENDING_MS + 50);
	}

	/**
	 * Merges adjacent image-only lines so a column layout can actually put the
	 * images side by side: a line break between embeds is a hard break in
	 * reading view and a separate block in Live Preview.
	 */
	async tidyImageLines(file: TFile): Promise<number> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const isActive = !!view && view.file?.path === file.path;
		const current = isActive ? view.editor.getValue() : await this.app.vault.read(file);
		const { content, joined } = joinAdjacentImageLines(current);
		if (joined === 0) return 0;

		if (isActive && view) {
			const editor = view.editor;
			const last = editor.lastLine();
			editor.replaceRange(content, { line: 0, ch: 0 }, { line: last, ch: editor.getLine(last).length });
		} else {
			await this.app.vault.modify(file, content);
		}
		return joined;
	}

	/** The view currently showing `path`, if any. */
	private viewFor(path: string): MarkdownView | null {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === path) return view;
		}
		return null;
	}

	private paneFor(path: string): HTMLElement | null {
		return this.viewFor(path)?.containerEl ?? null;
	}

	private alignFor(view: MarkdownView): Align {
		const file = view.file;
		if (!file) return 'inherit';
		const cache = this.app.metadataCache.getFileCache(file);
		return resolveAlign({
			frontmatter: cache?.frontmatter ?? null,
			folderPath: folderPathOf(file),
			settings: this.settings,
		});
	}

	private paintWidth(path: string, width: number): void {
		const el = this.paneFor(path);
		if (!el) return;
		el.style.setProperty('--isp-width', width > 0 ? `${width}px` : '100%');
		// The DOM no longer matches the cached key; let the next refresh correct it.
		this.lastState.delete(el);
	}

	private paintAlign(path: string, align: Align): void {
		const el = this.paneFor(path);
		if (!el) return;
		for (const option of ALIGNS) el.classList.toggle(`isp-align-${option}`, align === option);
		this.lastState.delete(el);
	}

	private paintLayout(path: string, layout: Layout): void {
		const view = this.viewFor(path);
		if (!view) return;
		const el = view.containerEl;
		el.classList.toggle('isp-layout-cols2', layout === 'cols2');
		el.classList.toggle('isp-layout-cols3', layout === 'cols3');
		// Switching layout must not leave a stale alignment behind for the
		// ~150ms until the scheduled reconcile: block display would fight the
		// columns, and a missing alignment would flash a single row.
		const align = this.alignFor(view);
		for (const option of ALIGNS) {
			el.classList.toggle(`isp-align-${option}`, layout === 'stack' && align === option);
		}
		this.lastState.delete(el);
	}

	async setFolderWidth(folderPath: string, width: number): Promise<void> {
		await this.upsertFolderRule(folderPath, (rule) => ({ ...rule, width }));
	}

	async setFolderAlign(folderPath: string, align: Align): Promise<void> {
		await this.upsertFolderRule(folderPath, (rule) => ({ ...rule, align }));
	}

	async setFolderLayout(folderPath: string, layout: Layout): Promise<void> {
		await this.upsertFolderRule(folderPath, (rule) => ({ ...rule, layout }));
	}

	private async upsertFolderRule(
		folderPath: string,
		update: (rule: { path: string; width?: number; align?: Align; layout?: Layout }) => {
			path: string;
			width?: number;
			align?: Align;
			layout?: Layout;
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

	async setGlobalLayout(layout: Layout): Promise<void> {
		this.settings.defaultLayout = layout;
		await this.saveSettings();
		this.scheduleRefresh(0);
	}

}
