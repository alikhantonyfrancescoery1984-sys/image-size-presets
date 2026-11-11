import { App, Modal, Notice } from 'obsidian';
import { t } from './i18n';
import { folderPathOf } from './resolve';
import { ALIGN_OPTIONS, LAYOUTS, SCOPES, SIZES } from './settings';
import type ImageSizePresetsPlugin from './main';
import type { Align, Layout, Scope, SizeOption } from './types';

export class SizePickerModal extends Modal {
	private readonly plugin: ImageSizePresetsPlugin;

	private targetScope: Scope;

	/** Optimistic values, so a row highlights before the cache settles. */
	private pendingAlign: Align | null = null;

	private pendingLayout: Layout | null = null;

	constructor(app: App, plugin: ImageSizePresetsPlugin, scope?: Scope) {
		super(app);
		this.plugin = plugin;
		this.targetScope = scope ?? (app.workspace.getActiveFile() ? 'note' : 'all');
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private sizeLabel(width: number): string {
		return width > 0 ? `${width}px` : t.noLimit;
	}

	private render(): void {
		const { contentEl } = this;
		const file = this.app.workspace.getActiveFile();
		const needFile = this.targetScope !== 'all' && !file;

		contentEl.empty();
		contentEl.addClass('isp-modal');
		this.setTitle(t.modalTitle);

		contentEl.createEl('p', { cls: 'isp-hint', text: t.modalHint });

		const scopeRow = contentEl.createDiv({ cls: 'isp-scopes' });
		for (const candidate of SCOPES) {
			const button = scopeRow.createEl('button', { cls: 'isp-scope', text: t.scope[candidate] });
			if (candidate === this.targetScope) button.addClass('is-active');
			button.addEventListener('click', () => {
				if (this.targetScope === candidate) return;
				this.targetScope = candidate;
				this.pendingLayout = null;
				this.pendingAlign = null;
				this.render();
			});
		}

		if (needFile) contentEl.createEl('p', { cls: 'isp-warn', text: t.needFile });

		const current = this.plugin.currentWidthFor(this.targetScope, file);
		const grid = contentEl.createDiv({ cls: 'isp-grid' });
		for (const size of SIZES) {
			const chip = grid.createEl('button', { cls: 'isp-chip' });
			if (current.width === size.width) chip.addClass('is-active');
			chip.createSpan({ cls: 'isp-chip-label', text: t.sizes[size.key] });
			chip.createSpan({ cls: 'isp-chip-value', text: this.sizeLabel(size.width) });
			chip.addEventListener('click', () => {
				void this.applySize(size, needFile);
			});
		}

		const currentLayout = this.pendingLayout ?? this.plugin.currentLayoutFor(this.targetScope, file);

		contentEl.createDiv({ cls: 'isp-subtitle', text: t.layoutTitle });
		const layoutRow = contentEl.createDiv({ cls: 'isp-aligns' });
		for (const option of LAYOUTS) {
			const button = layoutRow.createEl('button', { cls: 'isp-align', text: t.layout[option] });
			if (option === currentLayout) button.addClass('is-active');
			button.addEventListener('click', () => {
				void this.applyLayout(option, needFile);
			});
		}

		// Alignment forces block display, so it only makes sense while stacked.
		if (currentLayout === 'stack') {
			contentEl.createDiv({ cls: 'isp-subtitle', text: t.alignTitle });
			const alignRow = contentEl.createDiv({ cls: 'isp-aligns' });
			const currentAlign = this.pendingAlign ?? this.plugin.currentAlignFor(this.targetScope, file);
			for (const option of ALIGN_OPTIONS) {
				const button = alignRow.createEl('button', { cls: 'isp-align', text: t.align[option] });
				if (option === currentAlign) button.addClass('is-active');
				button.addEventListener('click', () => {
					void this.applyAlign(option, needFile);
				});
			}
		}

		const effective = this.plugin.effectiveWidthFor(file);
		const status = contentEl.createDiv({ cls: 'isp-status' });
		status.createDiv({
			text: t.status(this.sizeLabel(effective.width ?? 0), this.plugin.describeSource(effective)),
		});
		if (currentLayout !== 'stack') {
			status.createDiv({ cls: 'isp-status-note', text: t.layoutNote });
		}
		if (this.plugin.settings.overrideInlineWidth) {
			status.createDiv({ cls: 'isp-status-note', text: t.forceHint });
		}
	}

	private async applySize(size: SizeOption, needFile: boolean): Promise<void> {
		if (needFile) {
			new Notice(t.needFile);
			return;
		}

		const file = this.app.workspace.getActiveFile();
		const scopeLabel = t.scope[this.targetScope];

		if (this.targetScope === 'note') {
			if (!file) {
				new Notice(t.needFile);
				return;
			}
			await this.plugin.setNoteWidth(file, size.width);
		} else if (this.targetScope === 'folder') {
			if (!file) {
				new Notice(t.needFile);
				return;
			}
			await this.plugin.setFolderWidth(folderPathOf(file), size.width);
		} else {
			await this.plugin.setGlobalWidth(size.width);
		}

		new Notice(t.applied(scopeLabel, this.sizeLabel(size.width)));
		this.close();
	}

	private async applyLayout(layout: Layout, needFile: boolean): Promise<void> {
		if (needFile) {
			new Notice(t.needFile);
			return;
		}

		const file = this.app.workspace.getActiveFile();
		this.pendingLayout = layout;

		if (this.targetScope === 'note') {
			if (!file) {
				new Notice(t.needFile);
				return;
			}
			await this.plugin.setNoteLayout(file, layout);
			if (layout !== 'stack') {
				const joined = await this.plugin.tidyImageLines(file);
				if (joined > 0) new Notice(t.tidied(joined));
			}
		} else if (this.targetScope === 'folder') {
			if (!file) {
				new Notice(t.needFile);
				return;
			}
			await this.plugin.setFolderLayout(folderPathOf(file), layout);
		} else {
			await this.plugin.setGlobalLayout(layout);
		}

		this.render();
	}

	private async applyAlign(align: Align, needFile: boolean): Promise<void> {
		if (needFile) {
			new Notice(t.needFile);
			return;
		}

		const file = this.app.workspace.getActiveFile();
		this.pendingAlign = align;

		if (this.targetScope === 'note') {
			if (!file) {
				new Notice(t.needFile);
				return;
			}
			await this.plugin.setNoteAlign(file, align);
		} else if (this.targetScope === 'folder') {
			if (!file) {
				new Notice(t.needFile);
				return;
			}
			await this.plugin.setFolderAlign(folderPathOf(file), align);
		} else {
			await this.plugin.setGlobalAlign(align);
		}

		this.render();
	}
}
