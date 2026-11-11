/**
 * Pure resolution logic. No runtime imports on purpose: this module can be
 * bundled, type-stripped, or unit tested in isolation.
 */
import type { Align, FileLike, FolderRule, Layout, PluginSettings, Resolution } from './types';

/** Frontmatter key for the width. */
export const FM_KEY = 'image-width';

/** Frontmatter key for the alignment. */
export const FM_ALIGN_KEY = 'image-align';

/** Frontmatter key for the layout. */
export const FM_LAYOUT_KEY = 'image-layout';

/** Used when settings are missing or unusable. */
export const FALLBACK_WIDTH = 560;

export function normalizeFolder(path: string | null | undefined): string {
	let s = path === null || path === undefined ? '' : String(path);
	s = s.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
	return s;
}

export function folderPathOf(file: FileLike | null | undefined): string {
	if (!file) return '';
	if (file.parent && typeof file.parent.path === 'string') {
		return normalizeFolder(file.parent.path);
	}
	const p = typeof file.path === 'string' ? file.path : '';
	const idx = p.lastIndexOf('/');
	return idx === -1 ? '' : normalizeFolder(p.slice(0, idx));
}

/**
 * Normalizes any accepted spelling: a positive number is a pixel width,
 * 0 (or none/full/original/auto) means "no limit", null means "not set".
 */
export function normalizeWidth(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return null;
		return value > 0 ? Math.round(value) : 0;
	}
	if (typeof value !== 'string') return null;
	const s = value.trim().toLowerCase();
	if (s === '') return null;
	if (s === 'none' || s === 'full' || s === 'original' || s === 'auto') return 0;
	const n = parseFloat(s.replace(/px$/, ''));
	if (!Number.isFinite(n)) return null;
	return n > 0 ? Math.round(n) : 0;
}

export function normalizeAlign(value: unknown): Align | null {
	if (typeof value !== 'string') return null;
	const s = value.trim().toLowerCase();
	if (s === 'left' || s === 'center' || s === 'right') return s;
	if (s === 'inherit' || s === 'none' || s === 'default') return 'inherit';
	return null;
}

export function normalizeLayout(value: unknown): Layout | null {
	if (typeof value === 'number') {
		if (value === 2) return 'cols2';
		if (value === 3) return 'cols3';
		if (value === 1) return 'stack';
		return null;
	}
	if (typeof value !== 'string') return null;
	const s = value.trim().toLowerCase();
	if (s === '2' || s === 'two' || s === 'cols2') return 'cols2';
	if (s === '3' || s === 'three' || s === 'cols3') return 'cols3';
	if (s === '1' || s === 'stack' || s === 'stacked' || s === 'list' || s === 'none') return 'stack';
	return null;
}

/** Deepest matching folder rule wins: "a/b" beats "a". */
export function findFolderRule(folderPath: string, rules: FolderRule[] | undefined): FolderRule | null {
	const target = normalizeFolder(folderPath);
	let best: FolderRule | null = null;
	for (const rule of rules ?? []) {
		if (!rule) continue;
		const p = normalizeFolder(rule.path);
		if (p === '') {
			if (target === '' && !best) best = rule;
			continue;
		}
		if (target === p || target.startsWith(p + '/')) {
			if (!best || normalizeFolder(best.path).length < p.length) best = rule;
		}
	}
	return best;
}

/** Note frontmatter > folder rule > global default. Never returns null. */
export function resolveWidth(input: {
	frontmatter?: Record<string, unknown> | null;
	folderPath?: string;
	settings: PluginSettings;
}): Resolution {
	const noteValue = normalizeWidth(input.frontmatter ? input.frontmatter[FM_KEY] : null);
	if (noteValue !== null) return { width: noteValue, source: 'note' };

	const rule = findFolderRule(input.folderPath ?? '', input.settings.folderRules);
	if (rule && rule.width !== undefined) {
		const ruleWidth = normalizeWidth(rule.width);
		if (ruleWidth !== null) {
			return { width: ruleWidth, source: `folder:${normalizeFolder(rule.path)}` };
		}
	}

	const fallback = normalizeWidth(input.settings.defaultWidth);
	return { width: fallback === null ? FALLBACK_WIDTH : fallback, source: 'default' };
}

/** Note frontmatter > folder rule > global default. Falls back to "stack". */
export function resolveLayout(input: {
	frontmatter?: Record<string, unknown> | null;
	folderPath?: string;
	settings: PluginSettings;
}): Layout {
	const noteValue = normalizeLayout(input.frontmatter ? input.frontmatter[FM_LAYOUT_KEY] : null);
	if (noteValue !== null) return noteValue;

	const rule = findFolderRule(input.folderPath ?? '', input.settings.folderRules);
	const ruleLayout = rule ? normalizeLayout(rule.layout) : null;
	if (ruleLayout !== null) return ruleLayout;

	return normalizeLayout(input.settings.defaultLayout) ?? 'stack';
}

/** Note frontmatter > folder rule > global default. Falls back to "inherit". */
export function resolveAlign(input: {
	frontmatter?: Record<string, unknown> | null;
	folderPath?: string;
	settings: PluginSettings;
}): Align {
	const noteValue = normalizeAlign(input.frontmatter ? input.frontmatter[FM_ALIGN_KEY] : null);
	if (noteValue !== null) return noteValue;

	const rule = findFolderRule(input.folderPath ?? '', input.settings.folderRules);
	const ruleAlign = rule ? normalizeAlign(rule.align) : null;
	if (ruleAlign !== null) return ruleAlign;

	return normalizeAlign(input.settings.defaultAlign) ?? 'inherit';
}
