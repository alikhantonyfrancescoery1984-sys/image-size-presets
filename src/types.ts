export interface FolderRule {
	path: string;
	width: number;
}

export interface PluginSettings {
	defaultWidth: number;
	defaultHeight: number;
	folderRules: FolderRule[];
}

export type SizeKey = 'xs' | 's' | 'm' | 'l' | 'xl' | 'none';

export interface SizeOption {
	key: SizeKey;
	/** Pixel width cap. 0 means "no limit". */
	width: number;
}

export type Scope = 'note' | 'folder' | 'all';

export type FolderSource = `folder:${string}`;

/** A width that is guaranteed to resolve to a number. */
export interface Resolution {
	width: number;
	source: 'note' | 'default' | FolderSource;
}

/** A width for one specific layer, which may not be set at all. */
export interface ScopeResolution {
	width: number | null;
	source: 'note' | 'default' | 'unset' | FolderSource;
}

/** The minimum shape needed to locate a file's parent folder. */
export interface FileLike {
	path?: string;
	parent?: { path?: string } | null;
}
