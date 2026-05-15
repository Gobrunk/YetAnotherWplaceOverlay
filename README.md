# Yet Another Wplace Overlay

A Tampermonkey userscript that enhances the experience on [wplace.live](https://wplace.live).

## Features

- **Template overlay** — Upload an image and display it as a semi-transparent overlay on the canvas to guide pixel placement. Supports multi-tile templates with pixel-accurate diff highlighting.
- **Pixel highlight** — Visually mark incorrect pixels with configurable patterns (Cross, X, Full, or custom sub-pixel grid).
- **Color filter** — Hide specific palette colors from the overlay.
- **Palette menu reposition** — Button to move the Wplace color palette from bottom to top of the screen and vice versa.
- **Droplets & charge timer** — Displays your current droplets count and a live countdown to the next charge refill.
- **Template import/export** — Save templates to userscript storage and download them as PNG files.
- **Migration wizard** — Automatic schema migration when the template storage format changes between versions.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open the `tampermonkey.js` file (the build output) and copy its contents.
3. In Tampermonkey, create a new script, paste the content, and save.
4. Navigate to [wplace.live](https://wplace.live) — the overlay panel will appear automatically.

> **Note:** Do not install `src/main.js` directly. Always use the bundled `tampermonkey.js`.

## Development

### Prerequisites

- Node.js >= 18
- npm

### Setup

```bash
npm install
```

### Build

```bash
# Single build
npm run build

# Watch mode (rebuilds on file change)
npm run watch
```

The build bundles `src/main.js` and all its imports into `tampermonkey.js` via Rollup (IIFE format), prepending the Tampermonkey `@userscript` header automatically.

## Project structure

```
src/
  main.js              # Entry point — wires up all managers and bootstraps the UI
  overlay.js           # Base class: fluent DOM builder + window utilities (drag, minimize)
  window-main.js       # Main overlay window (template form, coords, status)
  window-settings.js   # Settings window (pixel highlight, template options)
  window-wizard.js     # Migration wizard (schema version upgrade)
  window-filter.js     # Color filter window
  template.js          # Template data model
  template-manager.js  # Template logic: create, render tile overlay, import/export
  api-manager.js       # Intercepts Wplace API calls (droplets, charges, tile data)
  settings-manager.js  # Settings persistence (auto-save to GM storage)
  palette.js           # Wplace color palette data
  styles.js            # CSS injection via GM_addStyle
  bridge.js            # Page-to-script communication bridge
  confetti.js          # Confetti animation
  utils.js             # Shared utilities (encode, base64, sleep, logging...)
rollup.config.js       # Build config
tampermonkey.js        # Build output (do not edit manually)
```

## Conventions

### Commit messages — Conventional Commits

Format: `<type>(<scope>): <description>`

| Type       | Usage                                          |
|------------|------------------------------------------------|
| `feat`     | New feature                                    |
| `fix`      | Bug fix                                        |
| `chore`    | Build, config, dependencies                    |
| `refactor` | Code restructuring without behavior change     |
| `style`    | CSS or formatting only                         |
| `docs`     | Documentation                                  |
| `perf`     | Performance improvement                        |

**Scopes:**

| Scope      | Corresponds to                              |
|------------|---------------------------------------------|
| `overlay`  | `overlay.js`                                |
| `template` | `template.js`, `template-manager.js`        |
| `api`      | `api-manager.js`                            |
| `settings` | `settings-manager.js`, `window-settings.js` |
| `ui`       | Windows, wizard, filter                     |
| `build`    | Rollup, `package.json`                      |

**Examples:**

```
feat(template): add opacity slider per template
fix(api): handle missing canvas element on page load
chore(build): upgrade rollup to v5
style(ui): align palette move button with DaisyUI tokens
refactor(overlay): extract drag logic into separate method
docs: add README and commit conventions
```

### Code style

| Element           | Convention          | Example                        |
|-------------------|---------------------|--------------------------------|
| Files             | `kebab-case`        | `template-manager.js`          |
| Classes           | `PascalCase`        | `TemplateManager`, `Overlay`   |
| Functions/methods | `camelCase`         | `renderTileOverlay()`          |
| Private methods   | `#camelCase`        | `#buildPaletteCache()`         |
| Constants         | `SCREAMING_SNAKE_CASE` | `SCRIPT_NAME`, `COLOR_PALETTE` |
| DOM IDs           | `bm-kebab-case`     | `bm-move-btn`, `bm-status`     |
| CSS classes       | `bm-kebab-case`     | `bm-window`, `bm-titlebar`     |
| GM storage keys   | `bmCamelCase`       | `bmUserSettings`, `bmTemplates` |

## License

[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)
