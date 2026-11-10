# Image Size Presets

Set a default image size for **a note**, **a folder**, or **your whole vault** — with one click, no CSS and no per-image dragging.

Obsidian caps images at their natural size by default, which means a 2940px screenshot fills the whole editor. Dragging the corner of every pasted screenshot gets old fast. This plugin replaces that with six presets and three scopes.

![picker](https://img.shields.io/badge/Obsidian-1.5.1%2B-6C5CE7) ![license](https://img.shields.io/badge/license-MIT-blue)

## What it does

Click the image icon in the ribbon (or run **Image size: open image size picker**) and you get:

- **Scope**: this note / this folder / all notes
- **Size**: Tiny 160 · Small 240 · Medium 400 · Large 640 · Extra large 900 · No limit
- A status line telling you which value is currently in effect and where it comes from

Pick a size, the panel closes, done. Two clicks.

## How the size is resolved

Highest priority first:

1. **This note** — stored as `image-width: 400` in the note's frontmatter. Editable in the Properties panel like any other property; set it to `none` for no limit.
2. **This folder** — stored in the plugin settings. The deepest matching rule wins (`AI learning/sub` beats `AI learning`).
3. **Global default** — 560px, adjust with a slider in the plugin settings.

Two details that matter:

- **It only caps, it never upscales.** An image narrower than the cap keeps its natural width, so icons and small diagrams stay sharp. A 2940px screenshot gets scaled down.
- **Existing `![[image|553]]` widths keep working.** They are only compressed further when they exceed the cap, so nothing you hand-tuned jumps around.

A separate **maximum height** cap (default 900px, configurable) keeps tall phone screenshots from dominating the page.

## Install

### BRAT (recommended while not in the community directory)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. **BRAT → Add beta plugin** → `alikhantonyfrancescoery1984-sys/image-size-presets`.
3. Enable **Image Size Presets** in **Settings → Community plugins**.

### Manual

Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/alikhantonyfrancescoery1984-sys/image-size-presets/releases) into `YourVault/.obsidian/plugins/image-size-presets/`, then reload Obsidian.

Requires Obsidian **1.5.1** or newer.

## What it does not touch

- **Canvas and Excalidraw** embeds — they are not `<img>` elements inside a Markdown view.
- **Pandoc / PDF / Word exports** — those read the width written in the Markdown, not what is displayed on screen. If you need exports to respect a size, the `image-width` frontmatter is visible but the export pipeline has the final say.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| Default maximum width | 560 | Cap for notes without their own value. `0` = no limit |
| Default maximum height | 900 | Caps tall screenshots. `0` = no limit |
| Folder rules | empty | Added automatically when you pick "this folder"; deletable |

## How it works

`styles.css` holds one rule:

```css
.markdown-preview-view img,
.markdown-reading-view img,
.markdown-rendered img,
.markdown-source-view.is-live-preview img {
	max-width: min(100%, var(--isp-width, 100%));
	max-height: var(--isp-height, none);
}
```

On every file open, layout change and metadata change, the plugin resolves the width for each open Markdown pane and writes `--isp-width` / `--isp-height` onto that pane's container element. Nothing is injected into other windows at runtime, so pop-out windows behave the same.

The resolution logic lives in `src/resolve.ts` as pure functions with no runtime imports, which is what the unit tests exercise.

## Development

```bash
npm install
npm run dev    # esbuild watch
npm run build  # tsc --noEmit + production bundle
npm test       # node:test, bundled with esbuild
npm run lint   # eslint + eslint-plugin-obsidianmd
```

`main.js` is a build artifact and is not committed; releases attach it.

## Known limitations

- Settings rows do not yet appear in Obsidian 1.13+'s settings search (the declarative `getSettingDefinitions()` API is not adopted yet).
- Folder rules match by path prefix, not by glob.

## License

MIT
