# Image Size Presets

Set a default image size for **a note**, **a folder**, or **your whole vault** — with one click, no CSS and no per-image dragging.

Obsidian shows images at their natural resolution, so a 2940px screenshot fills the editor. Dragging the corner of every pasted screenshot gets old fast. This plugin replaces that with six presets and three scopes.

![Obsidian](https://img.shields.io/badge/Obsidian-1.5.1%2B-6C5CE7) ![license](https://img.shields.io/badge/license-MIT-blue) ![release](https://img.shields.io/github/v/release/alikhantonyfrancescoery1984-sys/image-size-presets)

**[Install](#install)** · [中文说明](README.zh-CN.md)

<img src="docs/screenshot-stack.png" width="620">

## Install

Not in the community plugin directory yet. Two ways to install:

### BRAT (recommended — updates itself)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) and enable it.
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Paste `alikhantonyfrancescoery1984-sys/image-size-presets` and confirm.
4. Enable **Image Size Presets** in **Settings → Community plugins**.

BRAT checks for updates when Obsidian starts, so new versions arrive on their own.

### Manual download

1. Open the [latest release](https://github.com/alikhantonyfrancescoery1984-sys/image-size-presets/releases/latest).
2. Download `main.js`, `manifest.json` and `styles.css`.
3. Create `YourVault/.obsidian/plugins/image-size-presets/` and put the three files in it.
4. Reload Obsidian with `Cmd/Ctrl+R`, then enable the plugin in **Settings → Community plugins**.

Requires Obsidian **1.5.1** or newer. Nothing else needs to be installed.

### From source

```bash
git clone https://github.com/alikhantonyfrancescoery1984-sys/image-size-presets.git
cd image-size-presets
npm install
npm run build
cp main.js manifest.json styles.css "/path/to/YourVault/.obsidian/plugins/image-size-presets/"
```


## What it does

Click the image icon in the ribbon (or run **Image size: open image size picker**):

- **Scope**: this note / this folder / all notes
- **Size**: Tiny 160 · Small 240 · Medium 400 · Large 640 · Extra large 900 · No limit
- **Alignment**: left / center / right / follow default
- A status line naming the value in effect and which layer it came from

Pick a size, the panel closes, done.

## The chosen size wins

By default a preset **overrides the inline `|300` width** an image may carry. That is what makes the control feel responsive: switching 240 → 400 → 640 changes every oversized image in the note immediately.

Two properties are preserved:

- **Small images are not upscaled.** The image renders at its natural width, then the cap applies — a 160px icon stays 160px no matter which preset is active.
- **Nothing is written into the body of your notes.** The size lives in frontmatter (`image-width: 400`) and in plugin settings, never in the image embeds.

If you would rather keep hand-tuned inline widths, turn off **Unify width** in the plugin settings. Images then only shrink when they exceed the cap, and `|300` wins as before.

## Precedence

1. **This note** — `image-width: 400` in frontmatter (set `none` for no limit). Editable in the Properties panel.
2. **This folder** — stored in plugin settings; the deepest matching rule wins (`AI learning/sub` beats `AI learning`).
3. **Global default** — 560px.

Alignment resolves the same way, using `image-align: center` in frontmatter.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| Unify width (ignore inline `\|width`) | on | Chosen size applies to every image; off restores cap-only behaviour |
| Default maximum width | 560 | Fallback for notes without their own value. `0` = no limit |
| Default maximum height | 0 | Optional cap for tall screenshots. A height cap binds before the width, which makes the chosen width look wrong — leave it at 0 |
| Default alignment | follow default | Fallback alignment |
| Folder rules | empty | Added when you pick "this folder"; deletable |

## What it does not touch

- **Canvas and Excalidraw** embeds — not `<img>` elements inside a Markdown view.
- **Pandoc / PDF / Word exports** — those read the width written in the Markdown, not what is displayed on screen.

## How it works

Two rules in `styles.css`:

```css
.markdown-preview-view img, .markdown-reading-view img,
.markdown-rendered img, .markdown-source-view.is-live-preview img {
	max-width: min(100%, var(--isp-width, 100%));
	max-height: var(--isp-height, none);
}

.isp-force img { width: auto !important; }
```

On every file open, layout change and metadata change the plugin resolves width, alignment and the override flag for each open Markdown pane, then writes `--isp-width` / `--isp-height` and the classes onto that pane's container. No runtime `<style>` injection, so pop-out windows behave the same.

Three details exist to keep images from flickering or going unstyled:

- Clicking a preset paints the new value immediately and reconciles a moment later, so the picker never feels laggy while the metadata cache catches up.
- While Obsidian is rebuilding its metadata cache, `getFileCache()` returns `null`. That is treated as "not ready yet": the pane is left alone and retried, instead of falling back to the default width and resizing every image.
- The computed state for a pane is compared against the last applied one, so an unchanged note is never touched. Obsidian fires a metadata-changed event on every keystroke.

## Development

```bash
npm install
npm run dev         # esbuild watch
npm run build       # tsc --noEmit + production bundle
npm test            # node:test: resolution, render model, pane state, CSS contract
npm run test:layout # headless Chrome, measures real pixel widths
npm run preview     # regenerates docs/screenshot-stack.png
npm run lint        # eslint + eslint-plugin-obsidianmd
```

`main.js` is a build artifact and is not committed; releases attach it.

## Known limitations

- Settings rows do not appear in Obsidian 1.13+'s settings search yet (the declarative `getSettingDefinitions()` API is not adopted).
- Folder rules match by path prefix, not by glob.
- A max-height above 0 takes priority over the width on tall images.

## License

MIT
