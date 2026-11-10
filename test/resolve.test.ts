import test from 'node:test';
import assert from 'node:assert/strict';

import {
	FALLBACK_WIDTH,
	FM_KEY,
	findFolderRule,
	folderPathOf,
	normalizeFolder,
	normalizeWidth,
	resolveWidth,
} from '../src/resolve';
import type { PluginSettings } from '../src/types';

const settings: PluginSettings = {
	defaultWidth: 560,
	defaultHeight: 900,
	folderRules: [
		{ path: 'AI learning', width: 400 },
		{ path: 'AI learning/sub', width: 300 },
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

test('resolveWidth survives missing settings', () => {
	const broken = { defaultWidth: Number.NaN, defaultHeight: 0, folderRules: [] } as PluginSettings;
	assert.deepEqual(resolveWidth({ frontmatter: null, folderPath: '', settings: broken }), {
		width: FALLBACK_WIDTH,
		source: 'default',
	});
});
