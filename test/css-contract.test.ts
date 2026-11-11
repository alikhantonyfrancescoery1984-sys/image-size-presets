import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('styles.css', 'utf8');

test('the cap reads from the per-pane custom properties', () => {
	assert.match(css, /max-width:\s*min\(100%,\s*var\(--isp-width,\s*100%\)\)/);
	assert.match(css, /max-height:\s*var\(--isp-height,\s*none\)/);
});

test('unified mode neutralises inline widths', () => {
	assert.match(css, /\.isp-force img\s*\{[^}]*width:\s*auto\s*!important/);
});

test('all three alignment directions are defined', () => {
	for (const direction of ['left', 'center', 'right']) {
		assert.match(
			css,
			new RegExp(`\\.isp-align-${direction} img\\s*\\{[^}]*display:\\s*block`),
			`missing .isp-align-${direction}`
		);
	}
});

test('the cap applies in reading view, live preview and embeds', () => {
	for (const selector of [
		'.markdown-preview-view img',
		'.markdown-reading-view img',
		'.markdown-rendered img',
		'.markdown-source-view.is-live-preview img',
	]) {
		assert.ok(css.includes(selector), `missing selector ${selector}`);
	}
});

test('multi-column rules exist for two and three columns', () => {
	for (const cols of [2, 3]) {
		assert.match(css, new RegExp(`\.isp-layout-cols${cols} img\\s*\\{[^}]*width:\\s*calc\\(`));
	}
});

test('column rules come after .isp-force so they win the !important tie', () => {
	const force = css.indexOf('.isp-force img');
	const cols2 = css.indexOf('.isp-layout-cols2 img');
	const cols3 = css.indexOf('.isp-layout-cols3 img');
	assert.ok(force >= 0, 'missing .isp-force img');
	assert.ok(cols2 > force, '.isp-layout-cols2 must be declared after .isp-force');
	assert.ok(cols3 > force, '.isp-layout-cols3 must be declared after .isp-force');
});
