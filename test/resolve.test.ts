import test from 'node:test';
import assert from 'node:assert/strict';

import { FM_ALIGN_KEY, FM_KEY, FM_LAYOUT_KEY, findFolderRule, normalizeLayout, resolveLayout, folderPathOf, normalizeAlign, normalizeFolder, normalizeWidth, resolveAlign, resolveWidth } from '../src/resolve';
import type { PluginSettings } from '../src/types';

const settings: PluginSettings = {
	defaultWidth: 560,
	defaultHeight: 0,
	defaultAlign: 'inherit',
	overrideInlineWidth: true,
	schemaVersion: 2,
	folderRules: [
		{ path: 'AI learning', width: 400 },
		{ path: 'AI learning/sub', width: 300, align: 'center' },
		{ path: 'gallery', layout: 'cols3' },
	],
};

test('normalizeWidth accepts numbers, strings and suffixes', () => {
	assert.equal(normalizeWidth(400), 400);
	assert.equal(normalizeWidth('400'), 400);
	assert.equal(normalizeWidth('400px'), 400);
	assert.equal(normalizeWidth(3.7), 4);
});

test('normalizeWidth maps unlimited spellings to 0', () => {
	assert.equal(normalizeWidth('none'), 0);
	assert.equal(normalizeWidth('FULL'), 0);
	assert.equal(normalizeWidth('original'), 0);
	assert.equal(normalizeWidth('auto'), 0);
	assert.equal(normalizeWidth(-5), 0);
});

test('normalizeWidth returns null when not set', () => {
	assert.equal(normalizeWidth(null), null);
	assert.equal(normalizeWidth(undefined), null);
	assert.equal(normalizeWidth(''), null);
	assert.equal(normalizeWidth('abc'), null);
	assert.equal(normalizeWidth({}), null);
});

test('normalizeAlign accepts the four states and rejects junk', () => {
	assert.equal(normalizeAlign('center'), 'center');
	assert.equal(normalizeAlign('LEFT'), 'left');
	assert.equal(normalizeAlign('right'), 'right');
	assert.equal(normalizeAlign('none'), 'inherit');
	assert.equal(normalizeAlign('default'), 'inherit');
	assert.equal(normalizeAlign('middle'), null);
	assert.equal(normalizeAlign(null), null);
});

test('normalizeFolder trims separators', () => {
	assert.equal(normalizeFolder('/'), '');
	assert.equal(normalizeFolder('/a/b/'), 'a/b');
	assert.equal(normalizeFolder('a\\b'), 'a/b');
	assert.equal(normalizeFolder(undefined), '');
});

test('folderPathOf reads the parent folder', () => {
	assert.equal(folderPathOf({ path: 'a/b/c.md', parent: { path: 'a/b' } }), 'a/b');
	assert.equal(folderPathOf({ path: 'c.md' }), '');
	assert.equal(folderPathOf(null), '');
});

test('findFolderRule prefers the deepest match', () => {
	const rules = settings.folderRules;
	assert.equal(findFolderRule('AI learning', rules)?.width, 400);
	assert.equal(findFolderRule('AI learning/sub', rules)?.width, 300);
	assert.equal(findFolderRule('AI learning/sub/deeper', rules)?.width, 300);
});

test('findFolderRule does not bleed into sibling prefixes', () => {
	assert.equal(findFolderRule('AI learningX', settings.folderRules), null);
	assert.equal(findFolderRule('Other', settings.folderRules), null);
});

test('resolveWidth applies note > folder > default', () => {
	assert.deepEqual(resolveWidth({ frontmatter: { [FM_KEY]: 240 }, folderPath: 'AI learning', settings }), {
		width: 240,
		source: 'note',
	});
	assert.deepEqual(resolveWidth({ frontmatter: {}, folderPath: 'AI learning', settings }), {
		width: 400,
		source: 'folder:AI learning',
	});
	assert.deepEqual(resolveWidth({ frontmatter: null, folderPath: 'Other', settings }), {
		width: 560,
		source: 'default',
	});
});

test('a folder rule may carry alignment without a width', () => {
	const onlyAlign: PluginSettings = {
		...settings,
		folderRules: [{ path: 'AlignOnly', align: 'right' }],
	};
	assert.deepEqual(resolveWidth({ frontmatter: null, folderPath: 'AlignOnly', settings: onlyAlign }), {
		width: 560,
		source: 'default',
	});
	assert.equal(resolveAlign({ frontmatter: null, folderPath: 'AlignOnly', settings: onlyAlign }), 'right');
});

test('resolveWidth honours explicit "no limit"', () => {
	assert.deepEqual(resolveWidth({ frontmatter: { [FM_KEY]: 'none' }, folderPath: 'AI learning', settings }), {
		width: 0,
		source: 'note',
	});
	assert.deepEqual(
		resolveWidth({ frontmatter: {}, folderPath: '', settings: { ...settings, defaultWidth: 0 } }),
		{ width: 0, source: 'default' }
	);
});

test('resolveWidth falls through on junk values', () => {
	assert.deepEqual(resolveWidth({ frontmatter: { [FM_KEY]: 'abc' }, folderPath: 'AI learning', settings }), {
		width: 400,
		source: 'folder:AI learning',
	});
});

test('resolveAlign applies note > folder > default', () => {
	assert.equal(resolveAlign({ frontmatter: { [FM_ALIGN_KEY]: 'left' }, folderPath: 'AI learning/sub', settings }), 'left');
	assert.equal(resolveAlign({ frontmatter: {}, folderPath: 'AI learning/sub', settings }), 'center');
	assert.equal(resolveAlign({ frontmatter: {}, folderPath: 'AI learning', settings }), 'inherit');
	assert.equal(
		resolveAlign({ frontmatter: {}, folderPath: 'Other', settings: { ...settings, defaultAlign: 'right' } }),
		'right'
	);
});

test('resolveAlign lets a note opt back out to inherit', () => {
	assert.equal(
		resolveAlign({ frontmatter: { [FM_ALIGN_KEY]: 'none' }, folderPath: 'AI learning/sub', settings }),
		'inherit'
	);
});

test('resolveWidth survives missing settings', () => {
	const broken = { ...settings, defaultWidth: Number.NaN, folderRules: [] } as PluginSettings;
	assert.deepEqual(resolveWidth({ frontmatter: null, folderPath: '', settings: broken }), {
		width: 560,
		source: 'default',
	});
});

test('normalizeLayout accepts numbers, words and rejects junk', () => {
	assert.equal(normalizeLayout(2), 'cols2');
	assert.equal(normalizeLayout(3), 'cols3');
	assert.equal(normalizeLayout(1), 'stack');
	assert.equal(normalizeLayout('2'), 'cols2');
	assert.equal(normalizeLayout('COLS3'), 'cols3');
	assert.equal(normalizeLayout('stack'), 'stack');
	assert.equal(normalizeLayout('none'), 'stack');
	assert.equal(normalizeLayout(4), null);
	assert.equal(normalizeLayout(null), null);
});

test('resolveLayout applies note > folder > default', () => {
	assert.equal(resolveLayout({ frontmatter: { [FM_LAYOUT_KEY]: 2 }, folderPath: 'gallery', settings }), 'cols2');
	assert.equal(resolveLayout({ frontmatter: {}, folderPath: 'gallery', settings }), 'cols3');
	assert.equal(resolveLayout({ frontmatter: {}, folderPath: 'Other', settings }), 'stack');
	assert.equal(
		resolveLayout({ frontmatter: {}, folderPath: 'Other', settings: { ...settings, defaultLayout: 'cols2' } }),
		'cols2'
	);
});

test('a folder rule may carry a layout without a width', () => {
	assert.deepEqual(resolveWidth({ frontmatter: null, folderPath: 'gallery', settings }), {
		width: 560,
		source: 'default',
	});
	assert.equal(resolveLayout({ frontmatter: null, folderPath: 'gallery', settings }), 'cols3');
});
