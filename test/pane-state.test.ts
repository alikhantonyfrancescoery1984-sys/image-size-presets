import test from 'node:test';
import assert from 'node:assert/strict';

import { computePaneState, paneStateKey, samePaneState } from '../src/pane-state';
import type { PaneInput } from '../src/pane-state';
import type { PluginSettings } from '../src/types';

const settings: PluginSettings = {
	defaultWidth: 560,
	defaultHeight: 0,
	defaultAlign: 'inherit',
	defaultLayout: 'stack',
	overrideInlineWidth: true,
	schemaVersion: 2,
	folderRules: [{ path: 'AI learning', width: 400 }],
};

function input(patch: Partial<PaneInput> = {}): PaneInput {
	return {
		frontmatter: null,
		cacheReady: true,
		folderPath: '',
		settings,
		...patch,
	};
}

test('an unready metadata cache returns null instead of guessing a width', () => {
	// This is the flicker regression: returning the default width here makes a
	// 240px note jump to 560px, which forces the browser to re-decode every
	// image and show a blank box until it comes back.
	assert.equal(computePaneState(input({ cacheReady: false, frontmatter: null })), null);
});

test('a cache that is ready but empty is a real answer, not a null', () => {
	const state = computePaneState(input({ frontmatter: null, cacheReady: true }));
	assert.ok(state);
	assert.equal(state.width, '560px');
});

test('the note frontmatter wins over folder and default', () => {
	const state = computePaneState(
		input({ frontmatter: { 'image-width': 240 }, folderPath: 'AI learning' })
	);
	assert.equal(state?.width, '240px');
});

test('the folder rule applies when the note says nothing', () => {
	const state = computePaneState(input({ frontmatter: {}, folderPath: 'AI learning' }));
	assert.equal(state?.width, '400px');
});

test('"no limit" becomes 100%, never a pixel width', () => {
	const state = computePaneState(input({ frontmatter: { 'image-width': 'none' } }));
	assert.equal(state?.width, '100%');
});

test('height defaults to none and only becomes px when set', () => {
	assert.equal(computePaneState(input())?.height, 'none');
	assert.equal(
		computePaneState(input({ settings: { ...settings, defaultHeight: 1200 } }))?.height,
		'1200px'
	);
});

test('alignment is dropped while a multi-column layout is active', () => {
	const stacked = computePaneState(input({ frontmatter: { 'image-align': 'center' } }));
	assert.equal(stacked?.align, 'center');

	const columns = computePaneState(
		input({ frontmatter: { 'image-align': 'center', 'image-layout': 2 } })
	);
	assert.equal(columns?.layout, 'cols2');
	assert.equal(columns?.align, 'inherit');
});

test('the override flag travels with the state', () => {
	assert.equal(computePaneState(input())?.force, true);
	assert.equal(
		computePaneState(input({ settings: { ...settings, overrideInlineWidth: false } }))?.force,
		false
	);
});

test('identical inputs produce an identical key, so refresh skips the DOM', () => {
	const a = computePaneState(input({ frontmatter: { 'image-width': 240 } }));
	const b = computePaneState(input({ frontmatter: { 'image-width': 240 } }));
	assert.ok(a && b);
	assert.equal(paneStateKey(a), paneStateKey(b));
	assert.ok(samePaneState(a, b));
});

test('any real change produces a different key', () => {
	const base = computePaneState(input({ frontmatter: { 'image-width': 240 } }));
	const wider = computePaneState(input({ frontmatter: { 'image-width': 400 } }));
	assert.ok(base && wider);
	assert.notEqual(paneStateKey(base), paneStateKey(wider));
});

test('a null state never equals a real one', () => {
	const state = computePaneState(input());
	assert.ok(state);
	assert.equal(samePaneState(null, state), false);
	assert.equal(samePaneState(state, null), false);
	assert.equal(samePaneState(null, null), true);
});
