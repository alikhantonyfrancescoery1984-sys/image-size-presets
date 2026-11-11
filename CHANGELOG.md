# Changelog

## 1.3.1

### Fixed

- **Choosing a preset felt unresponsive.** The pane was repainted only after the
  frontmatter write resolved, and the picker waited for it before closing. On a
  slow disk that is a visible pause: measured 299ms for the write while the
  screen showed nothing. The DOM now updates and the modal closes first (1ms),
  and the write happens in the background.
- **An unrelated refresh could cancel the reconcile.** While a pane was waiting
  for its own write, any metadata event rescheduled the refresh and threw away
  the timer that was supposed to reconcile afterwards. The pending window is now
  re-armed instead.

## 1.3.0

### Removed

- **Multi-column layouts** (2 or 3 per row), together with the line-merging and
  `<br>` handling they needed. Papering over how Obsidian splits source lines
  added more surface than the feature was worth. Size presets and left / center /
  right alignment remain.

### Changed

- `image-layout` is no longer read; existing frontmatter keys are ignored and can
  be deleted.

## 1.2.3

### Fixed

- **"2 per row" still stacked when each image sat on its own line.** Consecutive
  image lines become one paragraph with a `<br>` between embeds in reading view,
  and separate blocks in Live Preview, so a 50% width could never put two on a
  line. The `<br>` breaks are now hidden in column mode, and choosing a column
  layout for the current note merges adjacent image-only lines in the source
  (undoable, prose untouched — only lines that contain nothing but embeds).

### Tests

- `joinAdjacentImageLines` covered by 7 unit tests, including "prose between
  images prevents merging" and "frontmatter is never touched".
- The headless layout harness now includes the `<br>` form, which is the shape
  that actually broke.

## 1.2.2

### Fixed

- **"2 per row" rendered as three 240px images.** The pixel cap (`max-width`)
  still applied in multi-column mode, clamping the 50%/33% widths straight back
  down. Columns now lift the cap to `100%` and share the row properly: two
  439px images in a 900px pane, three at 291px.
- **A pane opened while the metadata cache was unreadable never got styled.**
  1.2.1 started skipping unready panes to stop the flicker, but nothing ever
  retried, so those notes kept their inline widths and looked untouched. The
  plugin now retries (bounded) and also listens to `metadataCache: resolved`.

### Added

- `npm run test:layout` — renders the real `styles.css` in headless Chrome and
  measures pixel widths: caps, no-upscaling, legacy mode, 2/3 per row, centring.
- `npm run preview` — writes `docs/screenshot-*.png` from the same harness.

## 1.2.1

### Fixed

- **Images flickered: gone for a moment, then back.** When Obsidian rebuilt its
  metadata cache, `getFileCache()` returned `null` and the plugin treated that
  as "this note has no settings", falling back to the default width. A 240px
  note jumped to 560px, the browser re-decoded every image, and the boxes went
  blank until the bitmaps returned. The pane is now left untouched while the
  cache is unready, and the state is re-read once it is.
- **Redundant DOM writes on every keystroke.** Each `metadataCache` event
  rewrote the custom properties and seven classes on every open pane. The
  computed state is now compared first and written only when it actually
  differs.
- **A stale cache could undo a fresh choice.** After writing frontmatter the
  pane is painted immediately; a refresh inside the next 500ms is now skipped
  so the optimistic value cannot be reverted by the not-yet-updated cache.

## 1.2.0

### Added

- **Layout**: stacked / 2 per row / 3 per row, with the same note → folder → vault precedence as size (`image-layout: 2` in frontmatter). Images sharing a line split it evenly, so the right half of the pane stops going to waste.
- Alignment is hidden while a multi-column layout is active, because `display: block` would undo it.

### Fixed

- Switching layout left a stale alignment behind for the scheduled refresh window, which flashed a stacked block of images before the columns applied (and a single row when switching back).
- `paintLayout` now reconciles the alignment class immediately instead of waiting for the metadata cache.

## 1.1.0

The size picker now actually changes the images. Two things were fighting it.

### Added

- **Alignment**: left / center / right, with the same note → folder → vault precedence as size (`image-align` frontmatter). Opt-in, because block display stacks images that were placed side by side.
- **Unify width** setting (on by default): the chosen size overrides an inline `|300` width.
- Settings schema (`schemaVersion: 2`) with a migration.

### Fixed

- **Switching presets appeared to do nothing.** Most images carried an inline width smaller than the cap (`|209` under a 240px setting), so the cap never fired. The chosen size now wins.
- **Choosing a size took 80–300ms to paint**, because the refresh waited for the metadata cache. The new value is painted immediately and reconciled afterwards.
- **The 900px default height cap made widths look wrong.** On tall images the height binds first, so 640 and 900 rendered at nearly the same width. The default is now 0 (off); existing settings at the untouched 900 default are migrated to 0.

## 1.0.0

First release: six presets, three scopes, `image-width` frontmatter, folder rules, bilingual UI.
