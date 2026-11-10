import type { Scope, SizeKey } from './types';

export interface Strings {
	ribbon: string;
	commandOpen: string;
	commandNote: string;
	commandFolder: string;
	modalTitle: string;
	modalHint: string;
	needFile: string;
	scope: Record<Scope, string>;
	sizes: Record<SizeKey, string>;
	noLimit: string;
	status: (size: string, source: string) => string;
	sourceNote: string;
	sourceDefault: string;
	sourceUnset: string;
	sourceRoot: string;
	sourceFolder: (path: string) => string;
	applied: (scope: string, size: string) => string;
	settingsTitle: string;
	settingsDesc: string;
	defaultWidth: string;
	defaultWidthDesc: string;
	defaultHeight: string;
	defaultHeightDesc: string;
	folderRules: string;
	folderRulesEmpty: string;
	ruleDelete: string;
	rootFolder: string;
}

const zh: Strings = {
	ribbon: '图片大小',
	commandOpen: '打开图片大小面板',
	commandNote: '设置本笔记的图片大小',
	commandFolder: '设置本文件夹的图片大小',
	modalTitle: '图片大小',
	modalHint: '选一个大小就立刻生效。比它小的图片保持原样，不会被放大。',
	needFile: '先打开一篇笔记，才能设置本笔记或本文件夹。',
	scope: { note: '本笔记', folder: '本文件夹', all: '全部笔记' },
	sizes: { xs: '极小', s: '小', m: '中', l: '大', xl: '特大', none: '不限' },
	noLimit: '不限制',
	status: (size, source) => `现在实际显示：${size}（${source}）`,
	sourceNote: '来自本笔记',
	sourceDefault: '来自默认设置',
	sourceUnset: '这一层还没单独设置',
	sourceRoot: '来自库根目录的设置',
	sourceFolder: (path) => `来自文件夹「${path}」`,
	applied: (scope, size) => `图片大小：${scope} → ${size}`,
	settingsTitle: '图片大小',
	settingsDesc: '平时不用来这里：点左侧边栏的「图片大小」按钮，选大小就行。这里配的是所有笔记的兜底值。',
	defaultWidth: '默认最大宽度',
	defaultWidthDesc: '没有单独设置过的笔记，图片宽度不会超过这个值。0 表示不限制。',
	defaultHeight: '默认最大高度',
	defaultHeightDesc: '管竖长的手机截图。0 表示不限制。',
	folderRules: '文件夹规则',
	folderRulesEmpty: '还没有。在任意笔记里点「图片大小」→「本文件夹」，就会自动加一条。',
	ruleDelete: '删除',
	rootFolder: '（库根目录）',
};

const en: Strings = {
	ribbon: 'Image size',
	commandOpen: 'Open image size picker',
	commandNote: 'Set image size for this note',
	commandFolder: 'Set image size for this folder',
	modalTitle: 'Image size',
	modalHint: 'Pick a size and it applies immediately. Smaller images keep their original size.',
	needFile: 'Open a note first to set the size for a note or folder.',
	scope: { note: 'This note', folder: 'This folder', all: 'All notes' },
	sizes: { xs: 'Tiny', s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large', none: 'No limit' },
	noLimit: 'No limit',
	status: (size, source) => `Currently showing: ${size} (${source})`,
	sourceNote: 'from this note',
	sourceDefault: 'from the default setting',
	sourceUnset: 'not set on this layer',
	sourceRoot: 'from the vault root setting',
	sourceFolder: (path) => `from folder "${path}"`,
	applied: (scope, size) => `Image size: ${scope} → ${size}`,
	settingsTitle: 'Image size',
	settingsDesc: 'You normally do not need this tab: click the image icon in the ribbon and pick a size. These values are the fallback for every note.',
	defaultWidth: 'Default maximum width',
	defaultWidthDesc: 'Notes without their own setting never show images wider than this. 0 means no limit.',
	defaultHeight: 'Default maximum height',
	defaultHeightDesc: 'Caps tall phone screenshots. 0 means no limit.',
	folderRules: 'Folder rules',
	folderRulesEmpty: 'None yet. In any note, click "Image size" → "This folder" and a rule is added automatically.',
	ruleDelete: 'Delete',
	rootFolder: '(vault root)',
};

function detectChinese(): boolean {
	try {
		const lang = activeWindow.localStorage.getItem('language') ?? '';
		return String(lang).toLowerCase().startsWith('zh');
	} catch {
		return false;
	}
}

export const t: Strings = detectChinese() ? zh : en;
