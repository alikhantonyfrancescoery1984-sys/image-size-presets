import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Renders the layouts with the real styles.css in headless Chrome and saves
 * screenshots, so the result can be looked at instead of argued about.
 *
 *   node scripts/layout-preview.mjs
 *
 * Writes docs/screenshot-stack.png, -cols2.png, -cols3.png.
 */

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = resolve('docs');
mkdirSync(OUT, { recursive: true });

const WIDTH = 900;

/** Portrait 3:4 and landscape 2:1, matching the shapes people actually paste. */
function photo(n, portrait = true) {
	const w = portrait ? 600 : 1200;
	const h = portrait ? 800 : 600;
	const hue = [18, 205, 140, 285][(n - 1) % 4];
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
	<rect width="100%" height="100%" fill="hsl(${hue} 42% 62%)"/>
	<text x="50%" y="56%" font-family="sans-serif" font-size="${Math.round(w / 5.5)}" fill="hsl(${hue} 42% 97%)" text-anchor="middle">${n}</text>
	</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Obsidian puts the |width value on the img as a width attribute. */
const embed = (n, portrait = true) =>
	`<span class="internal-embed media-embed image-embed"><img src="${photo(n, portrait)}" width="209"></span>`;

const images = [embed(1), embed(2), embed(3, false), embed(4)];

function page({ title, subtitle, classes, height }) {
	return {
		height,
		html: `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${resolve('styles.css')}">
<style>
	html, body { margin: 0; background: #fbfbfa; }
	body { font: 15px/1.6 -apple-system, "PingFang SC", sans-serif; color: #222;
		padding: 26px 32px; width: ${WIDTH}px; }
	h1 { font-size: 17px; margin: 0 0 2px; font-weight: 600; }
	.sub { color: #8a8a8a; font-size: 13px; margin: 0 0 16px; }
	p { margin: 0; }
	.pane { --isp-width: 240px; --isp-height: none; width: ${WIDTH}px; }
</style>
</head><body>
<h1>${title}</h1>
<p class="sub">${subtitle}</p>
<div class="pane markdown-preview-view markdown-rendered ${classes}">
<p>${images.join('')}</p>
</div>
</body></html>`,
	};
}

const pages = [
	['stack', page({ title: '竖排 240px', subtitle: '一张一行，右侧大片留白', classes: 'isp-force', height: 760 })],
	['cols2', page({ title: '2 张一排', subtitle: '每行两张，平分整行宽度', classes: 'isp-force isp-layout-cols2', height: 620 })],
	['cols3', page({ title: '3 张一排', subtitle: '每行三张，平分整行宽度', classes: 'isp-force isp-layout-cols3', height: 520 })],
];

const dir = mkdtempSync(join(tmpdir(), 'isp-preview-'));
try {
	for (const [name, spec] of pages) {
		const file = join(dir, `${name}.html`);
		writeFileSync(file, spec.html);
		const out = join(OUT, `screenshot-${name}.png`);
		execFileSync(
			CHROME,
			[
				'--headless=new',
				'--disable-gpu',
				'--no-sandbox',
				'--hide-scrollbars',
				'--force-device-scale-factor=2',
				'--virtual-time-budget=3000',
				`--screenshot=${out}`,
				`--window-size=${WIDTH + 64},${spec.height}`,
				`file://${file}`,
			],
			{ stdio: 'ignore' }
		);
		console.log('wrote', out);
	}
} finally {
	rmSync(dir, { recursive: true, force: true });
}
