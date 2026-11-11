import type { Align, Scope, SizeKey } from './types';

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
	forceHint: string;
	sourceNote: string;
	sourceDefault: string;
	sourceUnset: string;
	sourceRoot: string;
	sourceFolder: (path: string) => string;
	applied: (scope: string, size: string) => string;
	alignTitle: string;
	align: Record<Align, string>;
	settingsTitle: string;
	settingsDesc: string;
	defaultWidth: string;
	defaultWidthDesc: string;
	defaultHeight: string;
	defaultHeightDesc: string;
	defaultAlignLabel: string;
	defaultAlignDesc: string;
	overrideLabel: string;
	overrideDesc: string;
	folderRules: string;
	folderRulesEmpty: string;
	ruleDelete: string;
	rootFolder: string;
	followDefault: string;
}

const zh: Strings = {
	ribbon: '图片大小',
	commandOpen: '打开图片大小面板',
	commandNote: '设置本笔记的图片大小',
	commandFolder: '设置本文件夹的图片大小',
	modalTitle: '图片大小',
	modalHint: '选一个大小立刻生效，选定的大小会压过图片自带的宽度。',
	needFile: '先打开一篇笔记，才能设置本笔记或本文件夹。',
	scope: { note: '本笔记', folder: '本文件夹', all: '全部笔记' },
	sizes: { xs: '极小', s: '小', m: '中', l: '大', xl: '特大', none: '不限' },
	noLimit: '不限制',
	status: (size, source) => `现在实际显示：${size}（${source}）`,
	forceHint: '已统一宽度：图片自带的 |宽度 会被忽略',
	sourceNote: '来自本笔记',
	sourceDefault: '来自默认设置',
	sourceUnset: '这一层还没单独设置',
	sourceRoot: '来自库根目录的设置',
	sourceFolder: (path) => `来自文件夹「${path}」`,
	applied: (scope, size) => `图片大小：${scope} → ${size}`,
	alignTitle: '对齐方式',
	align: { inherit: '跟随默认', left: '左', center: '居中', right: '右' },
	settingsTitle: '图片大小',
	settingsDesc: '平时不用来这里：点左侧边栏的「图片大小」按钮就行。这里配的是所有笔记的兜底值。',
	defaultWidth: '默认最大宽度',
	defaultWidthDesc: '没有单独设置过的笔记，图片宽度不会超过这个值。0 表示不限制。',
	defaultHeight: '默认最大高度',
	defaultHeightDesc: '建议保持 0。设了高度上限后，竖长图片会先撞到高度，导致你选的宽度看起来不准。',
	defaultAlignLabel: '默认对齐',
	defaultAlignDesc: '所有笔记的兜底对齐方式。',
	overrideLabel: '统一宽度（忽略图片自带的 |宽度）',
	overrideDesc: '开启后选定的大小对每张图都生效；关闭后图片只在自己比上限大时才会缩小，自带宽度优先。',
	folderRules: '文件夹规则',
	folderRulesEmpty: '还没有。在任意笔记里点「图片大小」→「本文件夹」，就会自动加一条。',
	ruleDelete: '删除',
	rootFolder: '（库根目录）',
	followDefault: '跟随默认',
};

const en: Strings = {
	ribbon: 'Image size',
	commandOpen: 'Open image size picker',
	commandNote: 'Set image size for this note',
	commandFolder: 'Set image size for this folder',
	modalTitle: 'Image size',
	modalHint: 'Pick a size and it applies immediately. The chosen size wins over inline widths.',
	needFile: 'Open a note first to set the size for a note or folder.',
	scope: { note: 'This note', folder: 'This folder', all: 'All notes' },
	sizes: { xs: 'Tiny', s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large', none: 'No limit' },
	noLimit: 'No limit',
	status: (size, source) => `Currently showing: ${size} (${source})`,
	forceHint: 'Width unified: inline |width values are ignored',
	sourceNote: 'from this note',
	sourceDefault: 'from the default setting',
	sourceUnset: 'not set on this layer',
	sourceRoot: 'from the vault root setting',
	sourceFolder: (path) => `from folder "${path}"`,
	applied: (scope, size) => `Image size: ${scope} → ${size}`,
	alignTitle: 'Alignment',
	align: { inherit: 'Default', left: 'Left', center: 'Center', right: 'Right' },
	settingsTitle: 'Image size',
	settingsDesc: 'You normally do not need this tab: click the image icon in the ribbon. These values are the fallback for every note.',
	defaultWidth: 'Default maximum width',
	defaultWidthDesc: 'Notes without their own setting never show images wider than this. 0 means no limit.',
	defaultHeight: 'Default maximum height',
	defaultHeightDesc: 'Leave at 0. A height cap binds before the width on tall images, which makes the chosen width look wrong.',
	defaultAlignLabel: 'Default alignment',
	defaultAlignDesc: 'Fallback alignment for every note.',
	overrideLabel: 'Unify width (ignore inline |width)',
	overrideDesc: 'When on, the chosen size applies to every image. When off, inline widths win and images only shrink if they exceed the cap.',
	folderRules: 'Folder rules',
	folderRulesEmpty: 'None yet. In any note, click "Image size" → "This folder" and a rule is added automatically.',
	ruleDelete: 'Delete',
	rootFolder: '(vault root)',
	followDefault: 'Follow default',
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
