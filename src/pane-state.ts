import { resolveAlign, resolveWidth } from './resolve';
import type { Align, PluginSettings } from './types';

/**
 * Everything the plugin writes onto one Markdown pane, as a plain value.
 * Kept separate from the DOM so it can be computed and compared cheaply.
 */
export interface PaneState {
	/** CSS value for --isp-width */
	width: string;
	/** CSS value for --isp-height */
	height: string;
	force: boolean;
	align: Align;
}

export interface PaneInput {
	/** null when the note has no frontmatter (valid) */
	frontmatter: Record<string, unknown> | null;
	/**
	 * Whether the metadata cache could be read at all. `false` means the cache
	 * is being rebuilt, which is NOT the same as "this note has no settings".
	 */
	cacheReady: boolean;
	folderPath: string;
	settings: PluginSettings;
}

/**
 * Returns the state to apply, or null when nothing should be touched.
 *
 * The null-on-unready-cache case is the fix for images flickering: falling back
 * to the default width while Obsidian rebuilds its metadata cache makes images
 * jump to a different size, which forces a re-decode and shows a blank box
 * until the bitmap comes back.
 */
export function computePaneState(input: PaneInput): PaneState | null {
	if (!input.cacheReady) return null;

	const { frontmatter, folderPath, settings } = input;

	const resolved = resolveWidth({ frontmatter, folderPath, settings });
	const align = resolveAlign({ frontmatter, folderPath, settings });
	const height = Number(settings.defaultHeight);
	const hasCap = resolved.width > 0;

	return {
		width: hasCap ? `${resolved.width}px` : '100%',
		height: Number.isFinite(height) && height > 0 ? `${height}px` : 'none',
		// "No limit" must not neutralise the inline width: that attribute is
		// exactly what Obsidian's drag-to-resize writes, so overriding it makes
		// dragging look broken. Unifying only makes sense when there is a cap.
		force: settings.overrideInlineWidth && hasCap,
		align,
	};
}

/** Stable string identity, used to skip DOM writes that would change nothing. */
export function paneStateKey(state: PaneState): string {
	return [state.width, state.height, state.force ? '1' : '0', state.align].join('|');
}

export function samePaneState(a: PaneState | null, b: PaneState | null): boolean {
	if (a === null || b === null) return a === b;
	return paneStateKey(a) === paneStateKey(b);
}
