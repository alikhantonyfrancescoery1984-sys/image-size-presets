---
name: image-size-presets
description: Install, configure, or extend the Image Size Presets Obsidian plugin — a TypeScript/esbuild plugin that caps image size per note, per folder, or vault-wide with a picker modal. Use when working on this repository, when a user asks how to make Obsidian images smaller without CSS or per-image dragging, or when adding presets, scopes, or resolution rules to it.
license: MIT
---

# Image Size Presets

An Obsidian plugin that caps how large embedded images render, with a two-click picker and three resolution layers. Repository: `alikhantonyfrancescoery1984-sys/image-size-presets`.

## When to use this skill

- A user wants smaller images in Obsidian but does not want to write CSS snippets or drag every image corner.
- Someone needs a default image width per folder, which no existing community plugin provides.
- You are modifying this repository and need its invariants.

## Architecture in one breath

`styles.css` holds a single cap rule reading two CSS custom properties. `src/main.ts` resolves a width for every open Markdown pane and writes `--isp-width` / `--isp-height` onto that pane's container element. `src/resolve.ts` holds all resolution logic as pure functions.

```
styles.css          one rule: max-width: min(100%, var(--isp-width, 100%))
src/main.ts         lifecycle, ribbon, commands, per-pane refresh
src/resolve.ts      pure: normalize + precedence, zero runtime imports
src/modal.ts        the six-button picker
src/setting-tab.ts  default width/height sliders + folder rule list
src/i18n.ts         zh/en strings, detected once from localStorage "language"
```

## Invariants — do not break these

1. **Cap, never upscale.** Only `max-width` / `max-height`. Never set `width`, or small icons get stretched and existing `![[img|240]]` values are overridden.
2. **Precedence is note > folder > default.** `image-width` frontmatter wins, then the deepest matching folder rule, then `defaultWidth`.
3. **`0` means "no limit", `null` means "not set".** The picker distinguishes them; `normalizeWidth` is the only place that maps spellings (`none`, `full`, `original`, `auto`, `400px`) to numbers.
4. **Never name a field on the Modal `scope`.** `Modal` already has a `scope` property (keyboard scope) and TypeScript rejects the subclass. Use `targetScope`.
5. **Timer functions use `window`, not `activeWindow`.** `eslint-plugin-obsidianmd` enforces this (`prefer-window-timers`).
6. **Static CSS belongs in `styles.css`, not an injected `<style>` element.** Obsidian loads plugin CSS into every window, which is what makes pop-outs work.
7. **`minAppVersion` must stay in sync with the APIs used.** `Modal.setTitle` needs 1.5.1; `versions.json` is keyed by version and validated by `obsidianmd/no-unsupported-api`.

## Common tasks

**Add a size preset** — append to `SIZES` in `src/settings.ts`, add a label to both `zh` and `en` in `src/i18n.ts`. The grid is 3 columns, so add in pairs of three.

**Add a scope** — extend `Scope` in `src/types.ts`, `SCOPES` in `settings.ts`, the `scope` strings in `i18n.ts`, then handle it in `main.ts#currentWidthFor` and `modal.ts#apply`.

**Change the default width** — `DEFAULT_SETTINGS.defaultWidth` in `src/settings.ts` (and `FALLBACK_WIDTH` in `src/resolve.ts`, used when settings are corrupt).

## Build and verify

```bash
npm install
npm run build   # tsc --noEmit && esbuild → main.js
npm test        # node:test over src/resolve.ts, bundled by esbuild
npm run lint    # eslint + eslint-plugin-obsidianmd
```

`main.js` is generated and gitignored; the release workflow attaches it.

## Release

```bash
npm version patch        # runs version-bump.mjs, syncs manifest.json + versions.json
git push --follow-tags   # tag triggers .github/workflows/release.yml
```

The workflow builds, tests, and attaches `main.js`, `manifest.json`, `styles.css` to the GitHub release. Community directory submission goes through a PR to `obsidianmd/obsidian-releases`, which validates:

- `id` must not contain `obsidian`
- `name` must not end with `Plugin`
- `description` must end with `.`, `?`, `!` or `)`

## Pitfalls seen in practice

- `require('main.js')` returns `{ default: PluginClass }` — a smoke-test harness must use `.default`.
- `node --test <dir>` treats the directory as a module; pass the explicit `*.test.mjs` path.
- Frontmatter writes go through `app.fileManager.processFrontMatter`; the callback parameter is `any`, so annotate it before indexing with `FM_KEY`.
