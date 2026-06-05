# Yet Another Wplace Overlay

A Tampermonkey userscript that enhances the experience on [wplace.live](https://wplace.live).

## Features

### Dashboard

A compact HUD that stays on screen at all times. Shows your current droplets count, a live countdown to the next charge refill, your next level progress, and the name of the currently active overlay.

### Multi-overlay management

Open the Overlays window to manage all your templates in one place. You can add, rename, activate, or remove overlays independently. Only the active overlay is rendered on the canvas.

### Template overlay

Upload a PNG image and it is displayed as a semi-transparent overlay on the canvas to guide pixel placement. Multi-tile templates are supported — the overlay spans across tile boundaries. Incorrect pixels are highlighted in real time as tile data is received.

### Color filter & stats

A detachable color window that gives you full visibility into the state of your overlay:

- **Search** — filter colors by name or hex value
- **Sort** — order by color ID, name, total pixels, correct pixels, or completion percentage, ascending or descending
- **Filter mode** — switch every color at once between *All visible*, *All hidden*, or *Selected* (show only the color currently picked in the Wplace palette), on top of the per-color eye toggles
- **Per-color stats** — see how many pixels of each color are correct vs. total, with a completion progress bar and a one-decimal completion percentage (only ever 100% once every pixel is correct)
- **Go to** — fly to the nearest incorrect pixel of a given color and auto-select it, ready to place

### Nearest incomplete pixel

A global button to jump to the closest pixel anywhere in the template that still needs to be placed. The camera smoothly zooms out, pans, and zooms back in instead of teleporting.

### Navigation settings

Tune how the overlay moves the camera from the **Navigation** section of the settings window. Independent sliders set the target zoom level and the animation speed for both *Go to nearest incorrect pixel* and *Go to overlay anchor pixel*.

### Pixel highlight

Visually mark incorrect pixels with a configurable pattern: Cross, X, Full block, or a custom sub-pixel grid overlay.

### Palette reposition

A button injected into the Wplace color palette to move it from the bottom of the screen to the top and back.

### Persistent windows

All overlay windows (main dashboard, overlays list, settings, color filter) remember their position across sessions.

### Template import/export

Templates are saved to userscript storage (GM storage) and can be exported as PNG files at any time.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open the `tampermonkey.js` file (the build output) and copy its contents.
3. In Tampermonkey, create a new script, paste the content, and save.
4. Navigate to [wplace.live](https://wplace.live) — the overlay panel will appear automatically.

> **Note:** Do not install `src/main.js` directly. Always use the bundled `tampermonkey.js`.

---

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

### Project structure

```
src/
  main.js                    # Entry point — wires up all managers and bootstraps the UI
  overlay.js                 # Base class: fluent DOM builder + window utilities (drag, minimize)
  window-main.js             # Main dashboard window
  window-template-select.js  # Overlay management window (add, rename, activate, remove)
  window-settings.js         # Settings window
  window-filter.js           # Color filter window (search, sort, stats, navigation)
  template.js                # Template data model
  template-manager.js        # Template logic: render, diff, import/export
  api-manager.js             # Intercepts Wplace API calls (droplets, charges, tile data)
  settings-manager.js        # Settings persistence (GM storage)
  palette.js                 # Wplace color palette data
  styles.js                  # CSS injection
  bridge.js                  # Page-to-script communication bridge
  confetti.js                # Confetti animation
  utils.js                   # Shared utilities
rollup.config.js             # Build config
tampermonkey.js              # Build output (do not edit manually)
```

---

## License

[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)
