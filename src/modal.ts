import { App, Modal, Notice } from 'obsidian';
import { t } from './i18n';
import { folderPathOf } from './resolve';
import { SCOPES, SIZES } from './settings';
import type ImageSizePresetsPlugin from './main';
import type { Scope, SizeOption } from './types';

export class SizePickerModal extends Modal {
	private readonly plugin: ImageSizePresetsPlugin;

	private targetScope: Scope;

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
				void this.apply(size, needFile);
			});
		}

		const effective = this.plugin.effectiveWidthFor(file);
		contentEl.createDiv({
			cls: 'isp-status',
			text: t.status(this.sizeLabel(effective.width ?? 0), this.plugin.describeSource(effective)),
		});
	}

	private async apply(size: SizeOption, needFile: boolean): Promise<void> {
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
}
