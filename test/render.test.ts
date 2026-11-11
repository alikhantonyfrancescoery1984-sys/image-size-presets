import test from 'node:test';
import assert from 'node:assert/strict';

import { SIZES } from '../src/settings';
import { itemsPerRow, renderedWidth } from './render';

const WIDE_PANE = 4000;

test('every preset lands exactly on its own value', () => {
	for (const size of SIZES) {
		const got = renderedWidth({
			naturalWidth: 2940,
			paneWidth: WIDE_PANE,
			inlineWidth: 553,
			unified: true,
			cap: size.width,
		});
		const want = size.width > 0 ? size.width : 2940;
		assert.equal(got, want, `preset ${size.key} (${size.width})`);
	}
});

test('presets are strictly increasing, so a switch is always visible', () => {
	const widths = SIZES.filter((size) => size.width > 0).map((size) => size.width);
	assert.deepEqual(widths, [...widths].sort((a, b) => a - b));
	for (let i = 1; i < widths.length; i += 1) {
		assert.ok(widths[i] > widths[i - 1], `${widths[i]} must exceed ${widths[i - 1]}`);
	}
});

test('smaller images are never upscaled', () => {
	assert.equal(renderedWidth({ naturalWidth: 160, paneWidth: WIDE_PANE, unified: true, cap: 640 }), 160);
	assert.equal(renderedWidth({ naturalWidth: 160, paneWidth: WIDE_PANE, unified: true, cap: 160 }), 160);
});

test('unified mode ignores an inline |width', () => {
	assert.equal(
		renderedWidth({ naturalWidth: 2940, paneWidth: WIDE_PANE, inlineWidth: 553, unified: true, cap: 400 }),
		400
	);
});

test('legacy mode respects an inline |width until it exceeds the cap', () => {
	assert.equal(
		renderedWidth({ naturalWidth: 2940, paneWidth: WIDE_PANE, inlineWidth: 553, unified: false, cap: 900 }),
		553
	);
	assert.equal(
		renderedWidth({ naturalWidth: 2940, paneWidth: WIDE_PANE, inlineWidth: 553, unified: false, cap: 400 }),
		400
	);
});

test('the pane width is a hard ceiling', () => {
	assert.equal(renderedWidth({ naturalWidth: 2940, paneWidth: 600, unified: true, cap: 900 }), 600);
});

test('a height cap binds before the width on tall images, which is why it defaults to 0', () => {
	const tall = { naturalWidth: 1080, naturalHeight: 1440, paneWidth: WIDE_PANE, unified: true, cap: 900 };
	assert.equal(renderedWidth({ ...tall, maxHeight: 900 }), 675);
	assert.equal(renderedWidth({ ...tall, maxHeight: 0 }), 900);
});

test('the reported case: 240 on a note whose images carry |209', () => {
	const scene = { naturalWidth: 1080, naturalHeight: 1440, paneWidth: 1200, inlineWidth: 209, cap: 240 };
	assert.equal(renderedWidth({ ...scene, unified: true }), 240);
	assert.equal(renderedWidth({ ...scene, unified: false }), 209);
});

test('two and three column layouts really produce two and three per row', () => {
	for (const container of [700, 900, 1100, 1400, 1600]) {
		assert.equal(itemsPerRow(container, 2), 2, `2 columns at ${container}px`);
		assert.equal(itemsPerRow(container, 3), 3, `3 columns at ${container}px`);
	}
});
