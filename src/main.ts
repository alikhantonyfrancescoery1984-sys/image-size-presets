import { MarkdownView, Plugin, type TFile } from 'obsidian';
import { t } from './i18n';
import { SizePickerModal } from './modal';
import { computePaneState, paneStateKey } from './pane-state';
import type { PaneState } from './pane-state';
import {
	FM_ALIGN_KEY,
	FM_KEY,
	findFolderRule,
	folderPathOf,
	normalizeAlign,
	normalizeFolder,
	normalizeWidth,
	resolveWidth,
} from './resolve';
import { ALIGNS, DEFAULT_SETTINGS, SETTINGS_SCHEMA } from './settings';
import { ImageSizeSettingTab } from './setting-tab';
import type { Align, PluginSettings, Scope, ScopeResolution } from './types';

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

	/** Writes the caps, the override flag and the alignment onto each pane. */
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
				if (now < pendingUntil) {
					// An unrelated refresh must not cancel the reconcile that
					// was scheduled for when the write lands.
					this.scheduleRefresh(pendingUntil - now + 20);
					continue;
				}
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
		for (const option of ALIGNS) el.classList.toggle(`isp-align-${option}`, state.align === option);
	}

	private clearPane(el: HTMLElement): void {
		this.lastState.delete(el);
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

	/**
	 * Applies the width to the DOM right now and remembers that the pane must
	 * not be reconciled until the write lands. Persisting is a separate step so
	 * the UI never waits for the disk.
	 */
	applyNoteWidth(file: TFile, width: number): void {
		this.pendingUntil.set(file.path, Date.now() + PENDING_MS);
		this.paintWidth(file.path, width);
		this.scheduleRefresh(PENDING_MS + 50);
	}

	async persistNoteWidth(file: TFile, width: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			fm[FM_KEY] = width > 0 ? width : 'none';
		});
	}

	async setNoteWidth(file: TFile, width: number): Promise<void> {
		this.applyNoteWidth(file, width);
		await this.persistNoteWidth(file, width);
	}

	applyNoteAlign(file: TFile, align: Align): void {
		this.pendingUntil.set(file.path, Date.now() + PENDING_MS);
		this.paintAlign(file.path, align);
		this.scheduleRefresh(PENDING_MS + 50);
	}

	async persistNoteAlign(file: TFile, align: Align): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			if (align === 'inherit') delete fm[FM_ALIGN_KEY];
			else fm[FM_ALIGN_KEY] = align;
		});
	}

	async setNoteAlign(file: TFile, align: Align): Promise<void> {
		this.applyNoteAlign(file, align);
		await this.persistNoteAlign(file, align);
	}

	/** The view currently showing `path`, if any. */
	private viewFor(path: string): MarkdownView | null {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === path) return view;
		}
		return null;
	}

	private paintWidth(path: string, width: number): void {
		const el = this.viewFor(path)?.containerEl;
		if (!el) return;
		el.style.setProperty('--isp-width', width > 0 ? `${width}px` : '100%');
		// The force class must follow the cap immediately, otherwise choosing
		// "no limit" leaves the inline width neutralised for the whole pending
		// window and dragging still looks broken.
		el.classList.toggle('isp-force', this.settings.overrideInlineWidth && width > 0);
		// The DOM no longer matches the cached key; let the next refresh correct it.
		this.lastState.delete(el);
	}

	private paintAlign(path: string, align: Align): void {
		const el = this.viewFor(path)?.containerEl;
		if (!el) return;
		for (const option of ALIGNS) el.classList.toggle(`isp-align-${option}`, align === option);
		this.lastState.delete(el);
	}

	setFolderWidth(folderPath: string, width: number): void {
		this.upsertFolderRule(folderPath, (rule) => ({ ...rule, width }));
	}

	setFolderAlign(folderPath: string, align: Align): void {
		this.upsertFolderRule(folderPath, (rule) => ({ ...rule, align }));
	}

	private upsertFolderRule(
		folderPath: string,
		update: (rule: { path: string; width?: number; align?: Align }) => {
			path: string;
			width?: number;
			align?: Align;
		}
	): void {
		const target = normalizeFolder(folderPath);
		const rules = this.settings.folderRules.slice();
		const index = rules.findIndex((rule) => normalizeFolder(rule.path) === target);
		if (index >= 0) rules[index] = update(rules[index]);
		else rules.push(update({ path: target }));
		this.settings.folderRules = rules;
		// Settings already live in memory: repaint now, write to disk after.
		this.refresh();
		void this.saveSettings();
	}

	setGlobalWidth(width: number): void {
		this.settings.defaultWidth = width;
		this.refresh();
		void this.saveSettings();
	}

	setGlobalAlign(align: Align): void {
		this.settings.defaultAlign = align;
		this.refresh();
		void this.saveSettings();
	}
}
