export function injectStyles() {
    GM_addStyle(`
      /* ── Fenêtre principale ── */
      .yawo-window {
        position: fixed;
        z-index: 9000;
        display: flex;
        flex-direction: column;
        width: 280px;
        background: #18181b;
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

      /* ── Barre de titre ── */
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
        transition: height .2s ease;
      }

      /* ── Groupes et lignes ── */
      .yawo-col    { display: flex; flex-direction: column; gap: 4px; }
      .yawo-row    { display: flex; flex-direction: row; align-items: center; gap: 4px; }
      .yawo-wrap   { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; }
      .yawo-spaced { justify-content: space-between; }
      .yawo-hidden { display: none !important; }

      /* Ligne de coordonnées : force la rangée horizontale et centrée */
      .yawo-col > .yawo-col:has(.yawo-jump-btn) {
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: center;
      }

      /* ── Boutons d'action (Disable / Create / Filter) ── */
      .yawo-action-btns { flex-wrap: nowrap !important; }
      .yawo-action-btns button { flex: 1; padding: 3px 4px !important; text-align: center; min-width: 0; white-space: nowrap; }

      /* ── Grille de statistiques ── */
      .yawo-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; background: rgba(255,255,255,.04); border-radius: 6px; padding: 6px 8px; }
      .yawo-stat-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow: hidden; }
      .yawo-stat-full { grid-column: 1 / -1; }
      .yawo-stat-label { font-size: 10px; color: rgba(255,255,255,.45); }
      .yawo-stat-value { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.9); font-variant-numeric: tabular-nums; }

      /* ── Séparateurs ── */
      .yawo-window hr {
        border: none;
        border-top: 1px solid rgba(255,255,255,.08);
        margin: 2px 0;
      }

      /* ── Boutons chrome (minimize, close…) ── */
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

      /* ── Bouton saut de coordonnées ── */
      .yawo-jump-btn {
        border: 1px solid rgba(80,160,255,.6) !important;
        border-radius: 50% !important;
        padding: 4px 6px !important;
        color: rgba(120,185,255,.9) !important;
        background: rgba(60,130,255,.12) !important;
        cursor: pointer !important;
        font-size: 11px !important;
        line-height: 1 !important;
        transition: background .12s, border-color .12s !important;
      }
      .yawo-jump-btn:hover {
        background: rgba(60,130,255,.28) !important;
        border-color: rgba(80,160,255,.9) !important;
      }

      /* ── Boutons standard (hors chrome, swatches, circulaires) ── */
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

      /* Input de coordonnées (largeur fixe, pas de spinners) */
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

      /* Zone de statut / textarea */
      .yawo-status-area { width: 100%; min-height: 3.5em; resize: vertical; font-family: inherit; font-size: inherit; box-sizing: border-box; }

      /* ── Titres ── */
      .yawo-window h1 { font-size: 13px; font-weight: 600; color: rgba(255,255,255,.9); margin: 0; }
      .yawo-window h2 { font-size: 11px; font-weight: 500; color: rgba(255,255,255,.7); margin: 0; }

      /* ── Texte courant ── */
      .yawo-window p, .yawo-window label, .yawo-window small { color: rgba(255,255,255,.6); margin: 0; }
      .yawo-text-light { color: rgba(255,255,255,.9); }
      .yawo-text-dark  { color: #000; }
      .yawo-text-bold  { font-weight: bold; }
      .yawo-countdown  { font-variant-numeric: tabular-nums; }

      /* ── Swatches couleur ── */
      .yawo-color-swatch { width: 1.5rem; height: 1.5rem; flex-shrink: 0; border-radius: 3px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
      .yawo-eye-btn      { background: none; border: none; cursor: pointer; padding: 0; width: 100%; height: 100%; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
      .yawo-eye-btn svg  { width: 100%; height: 100%; }
      .yawo-logo-img     { max-width: 1.5rem; max-height: 1.5rem; object-fit: contain; }

      /* ── Ligne couleur ── */
      .yawo-color-row { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 4px; }
      .yawo-color-row:hover { background: rgba(255,255,255,.05); }

      /* ── Prévisualisation template ── */
      .yawo-template-thumb { width: 2.5rem; height: 2.5rem; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,.06); }
      .yawo-template-info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

      /* ── Bouton info circulaire ── */
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
        border-color: rgba(100,160,255,.45);
        background: rgba(100,160,255,.07);
      }

      /* Bouton "Actif" vert */
      .yawo-btn-success {
        border-color: rgba(34,197,94,.45) !important;
        color: rgba(34,197,94,.9) !important;
        background: rgba(34,197,94,.07) !important;
        cursor: default !important;
      }

      /* Bouton danger (suppression) */
      .yawo-btn-danger {
        border-color: rgba(239,68,68,.35) !important;
        color: rgba(239,68,68,.75) !important;
        padding: 3px 7px !important;
      }
      .yawo-btn-danger:hover {
        background: rgba(239,68,68,.1) !important;
        border-color: rgba(239,68,68,.65) !important;
        color: rgba(239,68,68,1) !important;
      }
      .yawo-btn-danger svg { display: block; }

      /* Bouton renommage */
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

      /* Bouton pin (navigation vers le pixel ancre) */
      .yawo-btn-pin {
        background: rgba(60,130,255,.10) !important;
        border-color: rgba(80,160,255,.45) !important;
        color: rgba(120,185,255,.85) !important;
        padding: 3px 7px !important;
      }
      .yawo-btn-pin:hover {
        background: rgba(60,130,255,.24) !important;
        border-color: rgba(80,160,255,.85) !important;
        color: rgba(120,185,255,1) !important;
      }
      .yawo-btn-pin svg { display: block; }

      /* Input de renommage inline */
      .yawo-rename-input {
        background: rgba(0,0,0,.4);
        border: 1px solid rgba(100,160,255,.5);
        border-radius: 4px;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        padding: 1px 4px;
        width: 100%;
        outline: none;
        min-width: 0;
      }

      /* ── Section "Ajouter un overlay" ── */
      .yawo-add-section { border: none; }
      .yawo-add-section > summary {
        list-style: none;
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
      .yawo-add-section > summary::-webkit-details-marker,
      .yawo-add-section > summary::marker { display: none; content: ''; }
      .yawo-add-section > summary:hover {
        background: rgba(255,255,255,.05);
        color: rgba(255,255,255,.75);
        border-color: rgba(255,255,255,.22);
      }
      .yawo-add-section[open] > summary {
        border-radius: 6px 6px 0 0;
        border-bottom-color: transparent;
        color: rgba(255,255,255,.75);
        background: rgba(255,255,255,.04);
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
