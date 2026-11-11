import { FALLBACK_WIDTH } from './resolve';
import type { Align, Layout, PluginSettings, Scope, SizeOption } from './types';

/** Bumped when stored settings need a migration. */
export const SETTINGS_SCHEMA = 2;

export const DEFAULT_SETTINGS: PluginSettings = {
	defaultWidth: FALLBACK_WIDTH,
	defaultHeight: 0,
	defaultAlign: 'inherit',
	defaultLayout: 'stack',
	overrideInlineWidth: true,
	folderRules: [],
	schemaVersion: SETTINGS_SCHEMA,
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

/** Concrete alignments, in picker order. "inherit" is appended separately. */
export const ALIGNS: Align[] = ['left', 'center', 'right'];

export const ALIGN_OPTIONS: Align[] = ['left', 'center', 'right', 'inherit'];

/** Concrete layouts, in picker order. */
export const LAYOUTS: Layout[] = ['stack', 'cols2', 'cols3'];
