---
name: image-size-presets
description: Install, configure, or extend the Image Size Presets Obsidian plugin — a TypeScript/esbuild plugin that sets image size and alignment per note, per folder, or vault-wide with a picker modal. Use when working on this repository, when a user wants smaller Obsidian images without CSS or per-image dragging, or when adding presets, scopes, or resolution rules.
license: MIT
---

# Image Size Presets

An Obsidian plugin that controls how large embedded images render, with a two-click picker, three resolution layers, and an optional alignment.

Repository: `alikhantonyfrancescoery1984-sys/image-size-presets`

## When to use this skill

- A user wants smaller images in Obsidian without CSS snippets or dragging every corner.
- Someone needs a default image width per folder, which no community plugin provides.
- You are modifying this repository and need its invariants and failure modes.

## Architecture in one breath

`styles.css` holds two rules: the cap (reads `--isp-width` / `--isp-height`) and `.isp-force img { width: auto !important }`. `src/main.ts` resolves values per pane and writes the custom properties plus the `.isp-force` / `.isp-align-*` classes onto that pane's container. `src/resolve.ts` holds resolution as pure functions with no runtime imports.

```
styles.css          cap rule + .isp-force + .isp-align-{left,center,right}
src/main.ts         lifecycle, ribbon, commands, per-pane refresh, optimistic paint
src/resolve.ts      pure: normalize + precedence for width and alignment
src/modal.ts        scope row, six size chips, alignment row
src/setting-tab.ts  unify toggle, width/height sliders, default alignment, folder rules
src/i18n.ts         zh/en strings, detected once from localStorage "language"
test/               resolve.test, render.test (model), css-contract.test
```

## Invariants — do not break these

1. **The cap is `max-width`, never `width`** — except inside `.isp-force`, where `width: auto !important` is what makes the chosen size win over an inline `|300`. Setting `width: <n>px` anywhere would upscale small icons.
2. **Precedence is note > folder > default**, for width and alignment alike. `image-width` / `image-align` frontmatter, then the deepest folder rule, then the global default.
3. **`0` means "no limit", `null` means "not set".** `normalizeWidth` is the only place that maps spellings (`none`, `full`, `original`, `auto`, `400px`) to numbers.
4. **Never name a field on the Modal `scope`.** `Modal` already has a `scope` property (keyboard scope) and TypeScript rejects the subclass. Use `targetScope`.
5. **Timer functions use `window`, not `activeWindow`** (`obsidianmd/prefer-window-timers`).
6. **Static CSS belongs in `styles.css`, not an injected `<style>`.** Obsidian loads plugin CSS into every window; that is what makes pop-outs work.
7. **After writing frontmatter, paint before refreshing.** `metadataCache` lags the write, so `setNoteWidth`/`setNoteAlign` call `paintWidth`/`paintAlign` for instant feedback and only then schedule a reconcile.
8. **Bump `SETTINGS_SCHEMA` when defaults change meaningfully** and add a migration in `migrate()`. v1.0.x shipped a 900px height cap that made widths look wrong; schema 2 turns it off for untouched settings.
9. **`minAppVersion` must match the APIs used.** `Modal.setTitle` needs 1.5.1; `obsidianmd/no-unsupported-api` enforces it.

## Why there is no multi-column layout

One existed in 1.2.x and was removed in 1.3.0. Obsidian renders consecutive image
lines as one paragraph with `<br>` between embeds in reading view, and as separate
blocks in Live Preview, so pairing images required rewriting the note's line
breaks. Size and alignment are worth that complexity; columns were not.

## Why a height cap is dangerous

`max-height` binds before `max-width` on tall images, so 640 and 900 can render at nearly the same width and the picker looks broken. Keep the default at 0 and treat any non-zero value as advanced.

## Why alignment is opt-in

`display: block` stacks images that were deliberately placed side by side on one line. Notes that rely on a collage layout must keep `inherit`.

## Common tasks

**Add a size preset** — append to `SIZES` in `src/settings.ts` and add the label to both `zh` and `en` in `src/i18n.ts`. The grid is 3 columns.

**Add a scope** — extend `Scope` in `src/types.ts`, `SCOPES` in `settings.ts`, the `scope` strings in `i18n.ts`, then handle it in `main.ts#currentWidthFor`/`currentAlignFor` and in both `modal.ts` apply methods.

**Add an alignment direction** — extend `Align`, `ALIGNS`, `ALIGN_OPTIONS`, both `i18n` strings, and the `.isp-align-*` rule in `styles.css`. The CSS contract test will fail if the rule is missing, which is the intended guardrail.

## Tests

`npm test` bundles `test/all.test.ts` with esbuild and runs it under `node --test`. Three suites:

- `resolve.test.ts` — precedence, normalization, folder-rule prefix safety.
- `render.test.ts` — a model of the CSS cascade proving every preset lands exactly on its value and that inline widths are ignored in unified mode.
- `css-contract.test.ts` — asserts the declarations that make the above true actually exist in `styles.css`.

If you change the CSS, run the CSS contract test first; it is the cheapest signal that the behaviour changed.

## Build and release

```bash
npm install
npm run build   # tsc --noEmit && esbuild → main.js
npm test
npm run lint    # eslint + eslint-plugin-obsidianmd

npm version patch        # runs version-bump.mjs, syncs manifest.json + versions.json
git push --follow-tags   # tag triggers .github/workflows/release.yml
```

The release workflow builds, tests, and attaches `main.js`, `manifest.json`, `styles.css`. Community directory submission goes through a PR to `obsidianmd/obsidian-releases`, which validates:

- `id` must not contain `obsidian`
- `name` must not end with `Plugin`
- `description` must end with `.`, `?`, `!` or `)`

## Pitfalls seen in practice

- `require('main.js')` returns `{ default: PluginClass }` — smoke harnesses must use `.default`.
- `node --test <dir>` treats the directory as a module; pass the explicit `*.test.mjs` file.
- The `processFrontMatter` callback parameter is `any`; annotate it before indexing with `FM_KEY`.
- A DOM shim used for smoke tests must implement `classList.toggle` and `classList.remove`, not just `add`.
