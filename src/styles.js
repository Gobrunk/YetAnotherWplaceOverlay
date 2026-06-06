export function injectStyles() {
    GM_addStyle(`
      /* ── Color palette ──
         Single source of truth for the overlay's colors. Semantic accents are
         exposed both as a ready-to-use color (--yawo-*) and as an "r,g,b" triplet
         (--yawo-*-rgb) so callers can build their own alpha via rgba(var(...), a). */
      :root {
        --yawo-surface: #18181b;

        --yawo-accent: rgb(80,160,255);
        --yawo-accent-rgb: 80,160,255;
        --yawo-accent-light: rgb(120,185,255);
        --yawo-accent-light-rgb: 120,185,255;

        --yawo-success: rgb(34,197,94);
        --yawo-success-rgb: 34,197,94;

        --yawo-danger: rgb(239,68,68);
        --yawo-danger-rgb: 239,68,68;

        --yawo-warning: rgb(250,204,21);
        --yawo-warning-rgb: 250,204,21;
      }

      /* ── Main window ── */
      .yawo-window {
        position: fixed;
        z-index: 9000;
        display: flex;
        flex-direction: column;
        width: 280px;
        background: var(--yawo-surface);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.6);
        font-family: 'Roboto Mono', monospace, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        color: rgba(255,255,255,.75);
        user-select: none;
        -webkit-user-select: none;
        overflow: hidden;
      }

      /* ── Title bar ── */
      .yawo-titlebar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        cursor: grab;
        flex-shrink: 0;
        min-height: 32px;
        background: rgba(255,255,255,.03);
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
      .yawo-dragging .yawo-titlebar { cursor: grabbing; }
      .yawo-titlebar > div {
        flex: 1;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,.8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ── Zone de contenu ── */
      .yawo-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        overflow-y: auto;
        max-height: 80vh;
        flex: 1 1 auto;
        min-height: 0;
        transition: height .2s ease;
      }
      .yawo-window-resized .yawo-content {
        max-height: none;
      }
      .yawo-window-resized .yawo-filter-list {
        flex: 1 0 auto;
        max-height: none;
        overflow-y: auto;
      }

      /* ── Groupes et lignes ── */
      .yawo-col    { display: flex; flex-direction: column; gap: 4px; }
      .yawo-row    { display: flex; flex-direction: row; align-items: center; gap: 4px; }
      .yawo-wrap   { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; }
      .yawo-hidden { display: none !important; }

      /* Coordinate row: forces horizontal centered layout */
      .yawo-col > .yawo-col:has(.yawo-jump-btn) {
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: center;
      }

      /* ── Active-overlay card actions (Overlays / Filter) ──
         Neutral buttons (inherit the standard button look); only the layout
         and uppercase label treatment are customized here. */
      .yawo-overlay-actions { display: flex; gap: 6px; width: 100%; margin-top: 6px; }
      .yawo-action-btn {
        flex: 1;
        padding: 4px 6px !important;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: .05em;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ── Bottom footer (Settings / Color Converter) ──
         Fixed bar mirroring the title bar: tinted background, hairline on top,
         discreet icon-only chrome buttons aligned to the right. */
      .yawo-footer {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 2px;
        padding: 4px 8px;
        flex-shrink: 0;
        background: rgba(255,255,255,.03);
        border-top: 1px solid rgba(255,255,255,.08);
      }

      /* ── Statistiques : 2 blocs distincts ── */
      .yawo-stat-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 4px 8px;
        background: rgba(255,255,255,.04);
        border-radius: 6px;
        padding: 6px 8px;
      }
      .yawo-stat-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        background: rgba(255,255,255,.04);
        border-radius: 6px;
        padding: 8px;
      }
      .yawo-stat-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow: hidden; }
      .yawo-overlay-head { align-items: center; text-align: center; width: 100%; gap: 1px; }
      .yawo-overlay-name-row { display: flex; align-items: center; gap: 6px; width: 100%; }
      /* Invisible spacer matching the toggle width keeps the name visually centered */
      .yawo-toggle-spacer { flex-shrink: 0; width: 34px; }
      .yawo-stat-value.yawo-overlay-name { font-size: 14px; }

      /* Enable/disable toggle — pill switch with a neutral white knob; the track
         tints softly green when enabled (no vivid solid green, to stay muted). */
      .yawo-toggle {
        position: relative;
        flex-shrink: 0;
        width: 34px;
        height: 18px;
        padding: 0 !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.08) !important;
        border: 1px solid rgba(255,255,255,.14) !important;
        cursor: pointer;
        transition: background .15s, border-color .15s;
      }
      .yawo-toggle::after {
        content: '';
        position: absolute;
        top: 1px;
        left: 1px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: rgba(255,255,255,.55);
        transition: transform .15s, background .15s;
      }
      .yawo-toggle:hover { background: rgba(255,255,255,.12) !important; }
      .yawo-toggle--on {
        background: rgba(var(--yawo-success-rgb),.22) !important;
        border-color: rgba(var(--yawo-success-rgb),.45) !important;
      }
      .yawo-toggle--on:hover { background: rgba(var(--yawo-success-rgb),.30) !important; }
      .yawo-toggle--on::after { transform: translateX(16px); background: rgba(255,255,255,.9); }
      .yawo-stat-label { font-size: 9px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .05em; }
      .yawo-stat-value { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.9); font-variant-numeric: tabular-nums; }

      /* Stat row: centered cells with tinted icon badges */
      .yawo-stat-row .yawo-stat-cell { align-items: center; text-align: center; gap: 1px; }
      .yawo-stat-row .yawo-stat-value { font-size: 14px; }
      .yawo-stat-badge {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-size: 14px;
        line-height: 1;
        margin-bottom: 3px;
        background: rgba(var(--yawo-badge-rgb),.15);
        box-shadow: inset 0 0 0 1px rgba(var(--yawo-badge-rgb),.3);
        transition: background .12s;
      }
      .yawo-stat-cell:hover .yawo-stat-badge { background: rgba(var(--yawo-badge-rgb),.28); }
      .yawo-badge-charges  { --yawo-badge-rgb: var(--yawo-warning-rgb); }
      .yawo-badge-droplets { --yawo-badge-rgb: var(--yawo-accent-rgb); }
      .yawo-badge-level    { --yawo-badge-rgb: var(--yawo-success-rgb); }

      /* ── Active overlay completion ring ── */
      .yawo-ring { position: relative; width: 84px; height: 84px; margin: 6px auto 2px; }
      .yawo-ring-svg, .yawo-ring-svg svg { width: 100%; height: 100%; display: block; }
      .yawo-ring-svg svg { transform: scaleX(-1) rotate(-90deg); } /* start at top, fill counter-clockwise */
      .yawo-ring-track { fill: none; stroke: rgba(255,255,255,.1); stroke-width: 7; }
      .yawo-ring-arc {
        fill: none;
        stroke: var(--yawo-success);
        stroke-width: 7;
        stroke-linecap: round;
        transition: stroke-dashoffset .3s ease;
      }
      .yawo-ring-center {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .yawo-ring-pct { font-size: 15px; font-weight: 700; color: rgba(255,255,255,.9); font-variant-numeric: tabular-nums; line-height: 1; }

      /* ── Separators ── */
      .yawo-window hr {
        border: none;
        border-top: 1px solid rgba(255,255,255,.08);
        margin: 2px 0;
      }

      /* ── Chrome buttons (minimize, close…) ── */
      .yawo-chrome-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px 5px;
        line-height: 1;
        flex-shrink: 0;
        color: rgba(255,255,255,.45);
        border-radius: 4px;
        transition: color .12s, background .12s;
      }
      .yawo-chrome-btn:hover { color: rgba(255,255,255,.85); background: rgba(255,255,255,.08); }
      .yawo-chrome-btn svg { width: 1em; height: 1em; fill: currentColor; display: block; }

      /* ── Coordinate jump button ── */
      .yawo-jump-btn {
        border: 1px solid rgba(var(--yawo-accent-rgb),.6) !important;
        border-radius: 50% !important;
        padding: 4px 6px !important;
        color: rgba(var(--yawo-accent-light-rgb),.9) !important;
        background: rgba(var(--yawo-accent-rgb),.12) !important;
        cursor: pointer !important;
        font-size: 11px !important;
        line-height: 1 !important;
        transition: background .12s, border-color .12s !important;
      }
      .yawo-jump-btn:hover {
        background: rgba(var(--yawo-accent-rgb),.28) !important;
        border-color: rgba(var(--yawo-accent-rgb),.9) !important;
      }

      /* ── Standard buttons (excl. chrome, swatches, circular) ── */
      .yawo-window button:not(.yawo-eye-btn):not(.yawo-chrome-btn):not(.yawo-info-btn):not(.yawo-jump-btn) {
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.14);
        color: rgba(255,255,255,.78);
        border-radius: 5px;
        padding: 3px 8px;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        transition: background .12s, border-color .12s;
      }
      .yawo-window button:not(.yawo-eye-btn):not(.yawo-chrome-btn):not(.yawo-info-btn):not(.yawo-jump-btn):hover {
        background: rgba(255,255,255,.14);
        border-color: rgba(255,255,255,.28);
      }

      /* ── Inputs & selects ── */
      .yawo-window input[type="text"],
      .yawo-window input[type="number"],
      .yawo-window textarea,
      .yawo-window select {
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 5px;
        color: rgba(255,255,255,.85);
        padding: 3px 6px;
        font-size: 11px;
        font-family: inherit;
        box-sizing: border-box;
      }
      .yawo-window input:focus,
      .yawo-window textarea:focus,
      .yawo-window select:focus {
        outline: none;
        border-color: rgba(255,255,255,.35);
        background: rgba(255,255,255,.1);
      }

      /* Coordinate input (fixed width, no spinners) */
      .yawo-coord-input {
        width: 6.5ch;
        font-size: 11px;
        font-family: inherit;
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .yawo-coord-input::-webkit-inner-spin-button,
      .yawo-coord-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      .yawo-coord-input { -moz-appearance: textfield; }

      /* ── Title bar branding ── */
      .yawo-title { display: flex; align-items: baseline; gap: 6px; flex: 1; min-width: 0; }
      .yawo-title-text {
        font-size: 11px; font-weight: 600; letter-spacing: .02em;
        color: rgba(255,255,255,.9);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        min-width: 0; flex: 0 1 auto; margin: 0;
      }
      .yawo-title-version {
        font-size: 9px; font-weight: 500; color: rgba(255,255,255,.35);
        flex-shrink: 0; font-variant-numeric: tabular-nums;
      }

      /* ── Titres ── */
      .yawo-window h1 { font-size: 13px; font-weight: 600; color: rgba(255,255,255,.9); margin: 0; }
      .yawo-window h2 { font-size: 11px; font-weight: 500; color: rgba(255,255,255,.7); margin: 0; }

      /* ── Texte courant ── */
      .yawo-window p, .yawo-window label, .yawo-window small { color: rgba(255,255,255,.6); margin: 0; }
      .yawo-text-light { color: rgba(255,255,255,.9); }
      .yawo-countdown  { font-variant-numeric: tabular-nums; }

      /* ── Prévisualisation template ── */
      .yawo-template-info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

      /* ── Circular info button ── */
      .yawo-info-btn {
        border: 1px solid rgba(255,255,255,.3);
        border-radius: 50%;
        background: none;
        cursor: pointer;
        width: 1.1em;
        height: 1.1em;
        font-size: 0.7em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        padding: 0;
        color: rgba(255,255,255,.5);
        transition: background .12s, border-color .12s;
      }
      .yawo-info-btn:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.5); }

      /* ── Input fichier caché ── */
      .yawo-file-upload { position: relative; }
      .yawo-file-upload input[type="file"] { position: absolute; width: 0; height: 0; opacity: 0; }

      /* ── Cartes de sélection d'overlay ── */
      .yawo-template-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.03);
      }
      .yawo-template-card--active {
        border-color: rgba(var(--yawo-accent-rgb),.45);
        background: rgba(var(--yawo-accent-rgb),.07);
      }

      /* "Active" green button */
      .yawo-btn-success {
        border-color: rgba(var(--yawo-success-rgb),.45) !important;
        color: rgba(var(--yawo-success-rgb),.9) !important;
        background: rgba(var(--yawo-success-rgb),.07) !important;
        cursor: default !important;
      }

      /* Danger button (delete) */
      .yawo-btn-danger {
        border-color: rgba(var(--yawo-danger-rgb),.35) !important;
        color: rgba(var(--yawo-danger-rgb),.75) !important;
        padding: 3px 7px !important;
      }
      .yawo-btn-danger:hover {
        background: rgba(var(--yawo-danger-rgb),.1) !important;
        border-color: rgba(var(--yawo-danger-rgb),.65) !important;
        color: rgba(var(--yawo-danger-rgb),1) !important;
      }
      .yawo-btn-danger svg { display: block; }

      /* Rename button */
      .yawo-btn-rename {
        border-color: rgba(255,255,255,.2) !important;
        color: rgba(255,255,255,.45) !important;
        padding: 3px 7px !important;
      }
      .yawo-btn-rename:hover {
        background: rgba(255,255,255,.07) !important;
        color: rgba(255,255,255,.9) !important;
      }
      .yawo-btn-rename svg { display: block; }

      /* Pin button (navigate to anchor pixel) */
      .yawo-btn-pin {
        background: rgba(var(--yawo-accent-rgb),.10) !important;
        border-color: rgba(var(--yawo-accent-rgb),.45) !important;
        color: rgba(var(--yawo-accent-light-rgb),.85) !important;
        padding: 3px 7px !important;
      }
      .yawo-btn-pin:hover {
        background: rgba(var(--yawo-accent-rgb),.24) !important;
        border-color: rgba(var(--yawo-accent-rgb),.85) !important;
        color: rgba(var(--yawo-accent-light-rgb),1) !important;
      }
      .yawo-btn-pin svg { display: block; }

      /* More-options popover (appended to body, position:fixed) */
      .yawo-more-popover {
        position: fixed;
        display: none;
        align-items: center;
        gap: 4px;
        padding: 4px;
        background: var(--yawo-surface);
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,.55);
        z-index: 10000;
        font-family: 'Roboto Mono', monospace, sans-serif;
        font-size: 12px;
      }
      .yawo-more-popover button {
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.14);
        color: rgba(255,255,255,.78);
        border-radius: 5px;
        padding: 3px 8px;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        transition: background .12s, border-color .12s;
        line-height: 1;
      }
      .yawo-more-popover button:hover { background: rgba(255,255,255,.14); }

      /* Input de renommage inline */
      .yawo-rename-input {
        background: rgba(0,0,0,.4);
        border: 1px solid rgba(var(--yawo-accent-rgb),.5);
        border-radius: 4px;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        padding: 1px 4px;
        width: 100%;
        outline: none;
        min-width: 0;
      }

      /* ── Add / Import tab bar ── */
      .yawo-tab-bar { display: flex; gap: 4px; }
      .yawo-tab-btn {
        flex: 1;
        cursor: pointer;
        padding: 5px 8px;
        border-radius: 6px;
        border: 1px dashed rgba(255,255,255,.14);
        color: rgba(255,255,255,.45);
        font-size: 11px;
        background: transparent;
        transition: background .12s, color .12s, border-color .12s;
        user-select: none;
      }
      .yawo-tab-btn:hover {
        background: rgba(255,255,255,.05);
        color: rgba(255,255,255,.75);
        border-color: rgba(255,255,255,.22);
      }
      .yawo-tab-btn--active {
        border-radius: 6px 6px 0 0;
        border-bottom-color: transparent;
        color: rgba(255,255,255,.75);
        background: rgba(255,255,255,.04);
      }
      .yawo-tab-panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: rgba(255,255,255,.03);
        border: 1px dashed rgba(255,255,255,.14);
        border-top: none;
        border-radius: 0 0 6px 6px;
      }
      .yawo-add-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: rgba(255,255,255,.03);
        border: 1px dashed rgba(255,255,255,.14);
        border-top: none;
        border-radius: 0 0 6px 6px;
      }
      .yawo-form-label {
        font-size: 9px;
        color: rgba(255,255,255,.35);
        text-transform: uppercase;
        letter-spacing: .06em;
        font-weight: 600;
      }
      .yawo-coords-block { display: flex; flex-direction: column; gap: 5px; }
      .yawo-coords-header { display: flex; align-items: center; justify-content: space-between; }
      .yawo-coords-grid {
        display: grid;
        grid-template-columns: 30px 1fr 1fr;
        gap: 4px;
        align-items: center;
      }
      .yawo-coords-grid .yawo-form-label { text-align: right; padding-right: 2px; }
      .yawo-coords-grid .yawo-coord-input { width: 100%; box-sizing: border-box; text-align: left; }
      .yawo-btn-create {
        width: 100% !important;
        margin-top: 2px !important;
        padding: 5px 8px !important;
        background: rgba(255,255,255,.09) !important;
        border-color: rgba(255,255,255,.2) !important;
      }
      .yawo-btn-create:hover {
        background: rgba(255,255,255,.15) !important;
        border-color: rgba(255,255,255,.32) !important;
      }

      /* ── Range slider ── */
      .yawo-window input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        background: rgba(255,255,255,.15) !important;
        border-radius: 2px;
        outline: none;
        cursor: pointer;
        padding: 0;
        border: none !important;
      }
      .yawo-window input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(255,255,255,.85);
        cursor: pointer;
      }
      .yawo-window input[type="range"]::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(255,255,255,.85);
        cursor: pointer;
        border: none;
      }

      /* ── Resize handle ── */
      .yawo-resize-handle {
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 12px;
        height: 12px;
        cursor: nwse-resize;
        z-index: 1;
        background-image:
          radial-gradient(circle, rgba(255,255,255,.35) 1.5px, transparent 1.5px),
          radial-gradient(circle, rgba(255,255,255,.35) 1.5px, transparent 1.5px),
          radial-gradient(circle, rgba(255,255,255,.35) 1.5px, transparent 1.5px);
        background-size: 5px 5px;
        background-position: 1px 9px, 5px 5px, 9px 1px;
        background-repeat: no-repeat;
        opacity: 0;
        transition: opacity .15s;
      }
      .yawo-window:hover .yawo-resize-handle { opacity: 1; }
      .yawo-resize-handle.yawo-resizing      { opacity: 1; }
      .yawo-window:has([data-button-status="collapsed"]) .yawo-resize-handle { display: none; }

      /* ── Scrollbars ── */
      .yawo-window ::-webkit-scrollbar       { width: 4px; height: 4px; }
      .yawo-window ::-webkit-scrollbar-track { background: transparent; }
      .yawo-window ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 2px; }
      .yawo-window ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.32); }
    `);

    let fontLinkEl;
    const FONT_PLACEHOLDER = 'robotoMonoInjectionPoint';
    if (FONT_PLACEHOLDER.indexOf('@font-face') + 1) {
        GM_addStyle(FONT_PLACEHOLDER);
    } else {
        fontLinkEl = document.createElement('link');
        fontLinkEl.href  = 'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap';
        fontLinkEl.rel   = 'preload';
        fontLinkEl.as    = 'style';
        fontLinkEl.onload = function() { this.onload = null; this.rel = 'stylesheet'; };
        document.head?.appendChild(fontLinkEl);
    }
}
