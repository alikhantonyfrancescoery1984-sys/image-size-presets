# Changelog

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
