/**
 * Pure resolution logic. No runtime imports on purpose: this module can be
 * bundled, type-stripped, or unit tested in isolation.
 */
import type { FileLike, FolderRule, PluginSettings, Resolution } from './types';

/** Frontmatter key written into a note. */
export const FM_KEY = 'image-width';

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
	if (rule) {
		const ruleWidth = normalizeWidth(rule.width);
		if (ruleWidth !== null) {
			return { width: ruleWidth, source: `folder:${normalizeFolder(rule.path)}` };
		}
	}

	const fallback = normalizeWidth(input.settings.defaultWidth);
	return { width: fallback === null ? FALLBACK_WIDTH : fallback, source: 'default' };
}
