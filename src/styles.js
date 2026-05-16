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
      .yawo-stat-cell { display: flex; flex-direction: column; gap: 2px; }
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
        border: 1px solid rgba(255,255,255,.25) !important;
        border-radius: 50% !important;
        padding: 2px 5px !important;
        color: rgba(255,255,255,.6) !important;
        background: none !important;
        cursor: pointer !important;
        font-size: 11px !important;
        line-height: 1 !important;
        transition: background .12s, border-color .12s !important;
      }
      .yawo-jump-btn:hover {
        background: rgba(255,255,255,.1) !important;
        border-color: rgba(255,255,255,.45) !important;
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
