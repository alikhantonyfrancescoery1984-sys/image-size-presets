import { App, Modal, Notice } from 'obsidian';
import { t } from './i18n';
import { folderPathOf } from './resolve';
import { ALIGN_OPTIONS, SCOPES, SIZES } from './settings';
import type ImageSizePresetsPlugin from './main';
import type { Align, Scope, SizeOption } from './types';

export class SizePickerModal extends Modal {
	private readonly plugin: ImageSizePresetsPlugin;

	private targetScope: Scope;

	/** Optimistic alignment, so the row highlights before the cache settles. */
	private pendingAlign: Align | null = null;

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
				this.applySize(size, needFile);
			});
		}

		contentEl.createDiv({ cls: 'isp-subtitle', text: t.alignTitle });
		const alignRow = contentEl.createDiv({ cls: 'isp-aligns' });
		const currentAlign = this.pendingAlign ?? this.plugin.currentAlignFor(this.targetScope, file);
		for (const option of ALIGN_OPTIONS) {
			const button = alignRow.createEl('button', { cls: 'isp-align', text: t.align[option] });
			if (option === currentAlign) button.addClass('is-active');
			button.addEventListener('click', () => {
				this.applyAlign(option, needFile);
			});
		}

		const effective = this.plugin.effectiveWidthFor(file);
		const status = contentEl.createDiv({ cls: 'isp-status' });
		status.createDiv({
			text: t.status(this.sizeLabel(effective.width ?? 0), this.plugin.describeSource(effective)),
		});
		if (this.plugin.settings.overrideInlineWidth) {
			status.createDiv({ cls: 'isp-status-note', text: t.forceHint });
		}
	}

	/**
	 * Everything the user can feel happens synchronously: the pane is repainted
	 * and the modal closes before the frontmatter write is even started.
	 */
	private applySize(size: SizeOption, needFile: boolean): void {
		if (needFile) {
			new Notice(t.needFile);
			return;
		}

		const file = this.app.workspace.getActiveFile();
		const scopeLabel = t.scope[this.targetScope];
		const sizeText = this.sizeLabel(size.width);

		if (this.targetScope === 'all') {
			this.plugin.setGlobalWidth(size.width);
		} else if (!file) {
			new Notice(t.needFile);
			return;
		} else if (this.targetScope === 'folder') {
			this.plugin.setFolderWidth(folderPathOf(file), size.width);
		} else {
			this.plugin.applyNoteWidth(file, size.width);
			void this.plugin.persistNoteWidth(file, size.width).catch(() => {
				/* the scheduled reconcile restores the previous value */
			});
		}

		this.close();
		new Notice(t.applied(scopeLabel, sizeText));
	}

	private applyAlign(align: Align, needFile: boolean): void {
		if (needFile) {
			new Notice(t.needFile);
			return;
		}

		const file = this.app.workspace.getActiveFile();
		this.pendingAlign = align;

		if (this.targetScope === 'all') {
			this.plugin.setGlobalAlign(align);
		} else if (!file) {
			new Notice(t.needFile);
			return;
		} else if (this.targetScope === 'folder') {
			this.plugin.setFolderAlign(folderPathOf(file), align);
		} else {
			this.plugin.applyNoteAlign(file, align);
			void this.plugin.persistNoteAlign(file, align).catch(() => {
				/* the scheduled reconcile restores the previous value */
			});
		}

		this.render();
	}
}
