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

function pane({ id, width, height = 'none', force, align, images }) {
	const classes = [force ? 'isp-force' : '', align && align !== 'inherit' ? `isp-align-${align}` : '']
		.filter(Boolean)
		.join(' ');
	return `<div class="pane ${classes}" id="pane-${id}" style="width:${PANE}px;--isp-width:${width};--isp-height:${height}">
	<div class="markdown-preview-view markdown-rendered"><p>${images}</p></div>
</div>`;
}

const scenarios = [
	pane({ id: 'stack-240', width: '240px', force: true, images: IMG(3000, 553, 'a1') }),
	pane({ id: 'stack-small', width: '240px', force: true, images: IMG(150, null, 'b1') }),
	pane({
		id: 'legacy-cap',
		width: '240px',
		force: false,
		images: IMG(3000, 553, 'c1') + IMG(3000, 209, 'c2'),
	}),
	pane({ id: 'align-center', width: '240px', force: true, align: 'center', images: IMG(3000, null, 'f1') }),
	// A source line break between embeds renders as <br>; the size presets must
	// still cap both images at the chosen value.
	pane({
		id: 'br-separated',
		width: '240px',
		force: true,
		images: IMG(3000, 553, 'g1') + '<br>' + IMG(3000, 553, 'g2'),
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
		return [...paneEl.querySelectorAll('img')].map((img) => {
			const r = img.getBoundingClientRect();
			return { w: Math.round(r.width), top: Math.round(img.offsetTop), left: Math.round(img.offsetLeft) };
		});
	};
	for (const id of ['stack-240','stack-small','legacy-cap','align-center','br-separated']) {
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

check('stack 240 caps a |553 image', byId['stack-240'][0].w, 240);
check('stack 240 keeps a 150px image at 150', byId['stack-small'][0].w, 150);
check('legacy: |553 capped to 240', byId['legacy-cap'][0].w, 240);
check('legacy: |209 untouched', byId['legacy-cap'][1].w, 209);
check('align center offsets the image', byId['align-center'][0].left > 100, true);
check('br-separated: first image at 240', byId['br-separated'][0].w, 240);
check('br-separated: second image at 240', byId['br-separated'][1].w, 240);

console.log(failures === 0 ? '\nLAYOUT OK' : `\n${failures} LAYOUT FAILURES`);
process.exit(failures === 0 ? 0 : 1);
