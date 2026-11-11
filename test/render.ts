export interface Scene {
	naturalWidth: number;
	naturalHeight?: number;
	paneWidth: number;
	inlineWidth?: number;
	/** true when the plugin is in "unify width" mode */
	unified: boolean;
	/** 0 means no limit */
	cap: number;
	/** 0 or omitted means no height cap */
	maxHeight?: number;
}

/**
 * Models the two declarations the plugin relies on:
 *
 *   .isp-force img { width: auto !important }
 *   img { max-width: min(100%, var(--isp-width, 100%));
 *         max-height: var(--isp-height, none) }
 *
 * With `width: auto` the image renders at its natural width, which max-width
 * then clamps — so a 2940px screenshot lands exactly on the cap while a 160px
 * icon keeps its size.
 */
export function renderedWidth(scene: Scene): number {
	const base = scene.unified || scene.inlineWidth === undefined ? scene.naturalWidth : scene.inlineWidth;
	const cap = scene.cap > 0 ? scene.cap : Number.POSITIVE_INFINITY;

	let width = Math.min(base, cap, scene.paneWidth);

	const maxHeight = scene.maxHeight && scene.maxHeight > 0 ? scene.maxHeight : null;
	if (maxHeight && scene.naturalHeight) {
		const height = (width * scene.naturalHeight) / scene.naturalWidth;
		if (height > maxHeight) width = (maxHeight * scene.naturalWidth) / scene.naturalHeight;
	}

	return Math.round(width);
}

