import { FALLBACK_WIDTH } from './resolve';
import type { PluginSettings, Scope, SizeOption } from './types';

export const DEFAULT_SETTINGS: PluginSettings = {
	defaultWidth: FALLBACK_WIDTH,
	defaultHeight: 900,
	folderRules: [],
};

/** The six presets offered in the picker. 0 means "no limit". */
export const SIZES: SizeOption[] = [
	{ key: 'xs', width: 160 },
	{ key: 's', width: 240 },
	{ key: 'm', width: 400 },
	{ key: 'l', width: 640 },
	{ key: 'xl', width: 900 },
	{ key: 'none', width: 0 },
];

export const SCOPES: Scope[] = ['note', 'folder', 'all'];
