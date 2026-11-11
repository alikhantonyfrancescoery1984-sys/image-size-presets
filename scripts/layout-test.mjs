import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Layout test: renders a fake Obsidian reading view in headless Chrome, using
 * the real styles.css, and measures the resulting pixel widths.
 *
 * This is the only way to know whether the CSS contract actually produces the
 * widths we promise — jsdom does not do layout.
 */

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PANE = 900;

const IMG = (natural, widthAttr, id) =>
	`<span class="internal-embed media-embed image-embed" id="${id}">` +
	`<img src="data:image/svg+xml;utf8,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${natural}" height="${Math.round(natural * 0.75)}"></svg>`
	)}"${widthAttr ? ` width="${widthAttr}"` : ''}></span>`;

function pane({ id, cls, width, height = 'none', force, layout, align, images }) {
	const classes = [cls, force ? 'isp-force' : '', layout === 'cols2' ? 'isp-layout-cols2' : '', layout === 'cols3' ? 'isp-layout-cols3' : '', align && align !== 'inherit' ? `isp-align-${align}` : '']
		.filter(Boolean)
		.join(' ');
	return `<div class="pane ${classes}" id="pane-${id}" style="width:${PANE}px;--isp-width:${width};--isp-height:${height}">
	<div class="markdown-preview-view markdown-rendered"><p>${images}</p></div>
</div>`;
}

const scenarios = [
	pane({
		id: 'stack-240',
		width: '240px',
		force: true,
		images: IMG(3000, 553, 'a1'),
	}),
	pane({
		id: 'stack-small',
		width: '240px',
		force: true,
		images: IMG(150, null, 'b1'),
	}),
	pane({
		id: 'legacy-cap',
		width: '240px',
		force: false,
		images: IMG(3000, 553, 'c1') + IMG(3000, 209, 'c2'),
	}),
	pane({
		id: 'cols2',
		width: '240px',
		force: true,
		layout: 'cols2',
		images: [1, 2, 3, 4].map((n) => IMG(3000, 553, `d${n}`)).join(''),
	}),
	pane({
		id: 'cols3',
		width: '240px',
		force: true,
		layout: 'cols3',
		images: [1, 2, 3, 4, 5, 6].map((n) => IMG(3000, 553, `e${n}`)).join(''),
	}),
	pane({
		id: 'align-center',
		width: '240px',
		force: true,
		align: 'center',
		images: IMG(3000, null, 'f1'),
	}),
];

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${resolve('styles.css')}">
<style>
	body { margin: 0; font: 16px/1.5 sans-serif; }
	.pane { padding: 0; }
	p { margin: 0; }
</style>
</head><body>
${scenarios.join('\n')}
<pre id="out"></pre>
<script>
	const results = [];
	const measure = (id) => {
		const paneEl = document.getElementById('pane-' + id);
		const imgs = [...paneEl.querySelectorAll('img')];
		return imgs.map((img) => {
			const r = img.getBoundingClientRect();
			return { w: Math.round(r.width), top: Math.round(img.offsetTop), left: Math.round(img.offsetLeft) };
		});
	};
	for (const id of ['stack-240','stack-small','legacy-cap','cols2','cols3','align-center']) {
		results.push({ id, images: measure(id) });
	}
	document.getElementById('out').textContent = JSON.stringify(results);
</script>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'isp-layout-'));
const file = join(dir, 'harness.html');
writeFileSync(file, html);

let dom;
try {
	dom = execFileSync(
		CHROME,
		[
			'--headless=new',
			'--disable-gpu',
			'--no-sandbox',
			'--hide-scrollbars',
			'--force-device-scale-factor=1',
			'--virtual-time-budget=3000',
			'--window-size=1200,1600',
			'--dump-dom',
			`file://${file}`,
		],
		{ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
	);
} finally {
	rmSync(dir, { recursive: true, force: true });
}

const decode = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

const match = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!match) {
	console.error('could not read results from the rendered page');
	process.exit(1);
}

const results = JSON.parse(decode(match[1]));
const byId = Object.fromEntries(results.map((r) => [r.id, r.images]));

let failures = 0;
const check = (label, actual, expected) => {
	const ok = actual === expected;
	if (!ok) failures += 1;
	console.log(`${ok ? '✔' : '✘'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
};

// A: a 240px cap overrides an inline |553 on a huge image
check('stack 240 caps a |553 image', byId['stack-240'][0].w, 240);
// B: a 150px image is not upscaled to the 240 cap
check('stack 240 keeps a 150px image at 150', byId['stack-small'][0].w, 150);
// C: legacy mode caps 553 to 240 but leaves 209 alone
check('legacy: |553 capped to 240', byId['legacy-cap'][0].w, 240);
check('legacy: |209 untouched', byId['legacy-cap'][1].w, 209);

// D: two per row means the first two share a row and the third starts a new one
const cols2 = byId.cols2;
check('cols2: four images fill two rows', new Set(cols2.map((i) => i.top)).size, 2);
check('cols2: first row holds two', cols2.filter((i) => i.top === cols2[0].top).length, 2);
// The cap must not clamp the column width back down: that made "two per row"
// render as three 240px images with gaps.
check('cols2: images are wider than the 240px cap', cols2[0].w > 400, true);
check('cols2: images roughly half the 900px pane', cols2[0].w > 420 && cols2[0].w < 460, true);

// E: three per row
const cols3 = byId.cols3;
check('cols3: six images fill two rows', new Set(cols3.map((i) => i.top)).size, 2);
check('cols3: first row holds three', cols3.filter((i) => i.top === cols3[0].top).length, 3);
check('cols3: images roughly a third of the pane', cols3[0].w > 280 && cols3[0].w < 305, true);

// F: centring offsets the image from the left edge
const centered = byId['align-center'][0];
check('align center offsets the image', centered.left > 100, true);

console.log(failures === 0 ? '\nLAYOUT OK' : `\n${failures} LAYOUT FAILURES`);
process.exit(failures === 0 ? 0 : 1);
