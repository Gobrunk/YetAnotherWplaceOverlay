import { Overlay } from '../overlay.js';
import { WindowColorFilter } from './filters.js';
import { icon } from './common.js';
import { formatPct, formatNumber } from '../utils.js';

// Sync the enable/disable toggle's visual state with the templates' enabled flag.
function applyToggleState(btn, enabled) {
    btn.dataset.buttonStatus = enabled ? 'shown' : 'hidden';
    btn.classList.toggle('yawo-toggle--on', enabled);
    btn.title = enabled ? 'Disable templates' : 'Enable templates';
    const row = btn.closest('.yawo-active-row');
    if (row) row.classList.toggle('yawo-active-row--on', enabled);
}

export class WindowMain extends Overlay {
    constructor(name, version) {
        super(name, version);
        this.windowId = 'yawo-window-main';
    }

    updateActiveOverlayName(name) {
        this.setElementContent('yawo-active-overlay', name ?? '—');
        this.updateCompletion(this.apiManager?.templateManager?.getCompletionStats?.() ?? null);
    }

    updateCompletion(stats) {
        const wrap = document.querySelector('#yawo-completion');
        const frac = document.querySelector('#yawo-active-frac');
        if (!wrap) return;
        if (!stats) {
            wrap.style.display = 'none';
            if (frac) frac.style.display = 'none';
            return;
        }
        const { pct, correct, total } = stats;
        wrap.style.display = '';
        const arc   = wrap.querySelector('#yawo-completion-arc');
        const numEl = wrap.querySelector('#yawo-completion-num');
        const CIRC  = 2 * Math.PI * 42;
        if (arc) {
            arc.style.strokeDasharray  = `${CIRC}`;
            arc.style.strokeDashoffset = `${CIRC * (1 - Math.min(pct, 100) / 100)}`;
        }
        if (numEl) numEl.textContent = `${formatPct(correct, total)}`;
        if (frac) {
            frac.style.display = '';
            frac.textContent = `${formatNumber(correct)} / ${formatNumber(total)} px`;
        }
    }

    // Toggle the ruler tool: when on, the next two pixel clicks on Wplace are
    // measured. State lives on the ApiManager (it owns the click capture).
    toggleRuler() {
        const api = this.apiManager;
        if (!api) return;
        api.rulerActive = !api.rulerActive;
        api.rulerPoints = [];
        api.postRulerHighlight(); // clear any markers left from a previous measurement
        const win     = document.querySelector(`#${this.windowId}`);
        const btn     = win?.querySelector('.yawo-ruler-btn');
        const readout = win?.querySelector('#yawo-ruler');
        btn?.classList.toggle('yawo-chrome-btn--active', api.rulerActive);
        readout?.classList.toggle('yawo-hidden', !api.rulerActive);
        if (api.rulerActive) {
            this.setRulerReadout(null);
            this.setStatus('Ruler on — click the first pixel.');
        } else {
            this.setStatus('Ruler off.');
        }
    }

    // Render the ruler readout. `null` → initial prompt; `{ a }` → first point
    // captured; `{ a, b, dx, dy, diag }` → full measurement.
    setRulerReadout(state) {
        const el = document.querySelector('#yawo-ruler-text');
        if (!el) return;
        const glob = c => `${Number(c[0]) * 1000 + Number(c[2])}, ${Number(c[1]) * 1000 + Number(c[3])}`;
        if (!state) {
            el.textContent = 'Click the first pixel on Wplace.';
        } else if (!state.b) {
            el.textContent = `A (${glob(state.a)}) — click the second pixel.`;
        } else {
            el.textContent = `Δx ${state.dx} · Δy ${state.dy} · ⟂ ${state.diag.toFixed(1)} px`;
        }
    }

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            this.setError('Main window already exists!');
            return;
        }
        this.addDiv({ id: this.windowId, class: 'yawo-window yawo-window-main', style: 'top: 10px; left: unset; right: 75px;' })
            .addWindowHeader({ title: this.name, statusDot: true })
            .addDiv({ class: 'yawo-content' })
                // ── Hero: completion ring + overlay info (name/fraction + active pill).
                //    .yawo-hero / .yawo-overlay-info are display:contents in normal
                //    mode (so children stack as before, ordering restored via CSS),
                //    and become a side-by-side flex row in compact mode. ──
                .addDiv({ class: 'yawo-hero' })
                    // ── Completion ring ──
                    .addDiv({ id: 'yawo-completion', class: 'yawo-ring', style: 'display:none;' })
                        .addDiv({ class: 'yawo-ring-svg', innerHTML: `
                            <svg viewBox="0 0 100 100" aria-hidden="true">
                              <circle class="yawo-ring-track" cx="50" cy="50" r="42"/>
                              <circle id="yawo-completion-arc" class="yawo-ring-arc" cx="50" cy="50" r="42"/>
                            </svg>` }).up()
                        .addDiv({ class: 'yawo-ring-center' })
                            .addDiv({ class: 'yawo-ring-value' })
                                .addSpan({ id: 'yawo-completion-num', class: 'yawo-ring-num' }).up()
                                .addSpan({ textContent: '%', class: 'yawo-ring-sign' }).up()
                            .up()
                            .addSmall({ textContent: 'Complete', class: 'yawo-ring-label' }).up()
                        .up()
                    .up()
                    .addDiv({ class: 'yawo-overlay-info' })
                        // ── Active overlay name + pixel fraction ──
                        .addDiv({ class: 'yawo-overlay-title-row' })
                            .addSpan({ id: 'yawo-active-overlay', class: 'yawo-overlay-name' }).up()
                            .addSpan({ id: 'yawo-active-frac', class: 'yawo-overlay-frac yawo-mono', style: 'display:none;' }).up()
                        .up()
                        // ── Enable/disable templates pill ──
                        .addDiv({ class: 'yawo-active-row' })
                            .addSpan({ class: 'yawo-active-dot' }).up()
                            .addSpan({ textContent: 'Overlay active', class: 'yawo-active-label' }).up()
                            .addButton({ class: 'yawo-toggle', role: 'switch', title: 'Disable templates', 'aria-label': 'Toggle templates', 'data-button-status': 'shown' }, (overlay, btn) => {
                                applyToggleState(btn, overlay.apiManager?.templateManager?.isEnabled ?? true);
                                btn.onclick = () => {
                                    const next = btn.dataset.buttonStatus !== 'shown';
                                    overlay.apiManager?.templateManager?.setEnabled(next);
                                    applyToggleState(btn, next);
                                    overlay.setStatus(next ? 'Enabled templates!' : 'Disabled templates!');
                                };
                            }).up()
                        .up()
                    .up()
                .up()
                // ── Stat row ──
                .addDiv({ class: 'yawo-stat-row' })
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSpan({ class: 'yawo-stat-badge yawo-badge-charges', innerHTML: icon('bolt') }).up()
                        .addCountdownTimer(Date.now(), 1000, { class: 'yawo-stat-value yawo-mono' }, (overlay, timerEl) => {
                            if (overlay.apiManager) overlay.apiManager.chargesTimerId = timerEl.id;
                        }).up()
                        .addSmall({ textContent: 'Charges', class: 'yawo-stat-label' }).up()
                    .up()
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSpan({ class: 'yawo-stat-badge yawo-badge-droplets', innerHTML: icon('droplet') }).up()
                        .addSpan({ id: 'yawo-droplets', class: 'yawo-stat-value yawo-mono' }).up()
                        .addSmall({ textContent: 'Droplets', class: 'yawo-stat-label' }).up()
                    .up()
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSpan({ class: 'yawo-stat-badge yawo-badge-level', innerHTML: icon('trendingUp') }).up()
                        .addSpan({ id: 'yawo-next-level', class: 'yawo-stat-value yawo-mono' }).up()
                        .addSmall({ textContent: 'Next level', class: 'yawo-stat-label' }).up()
                    .up()
                .up()
                // ── Actions ──
                .addDiv({ class: 'yawo-overlay-actions' })
                    .addButton({ class: 'yawo-action-btn', innerHTML: `${icon('layers')}<span>Overlays</span>` }, (overlay, btn) => {
                        btn.onclick = () => overlay.apiManager?.templateManager?.windowTemplateSelect?.toggle();
                    }).up()
                    .addButton({ class: 'yawo-action-btn', innerHTML: `${icon('sliders')}<span>Filters</span>`, 'data-yawo-filter': '1' }, (overlay, btn) => {
                        btn.onclick = () => new WindowColorFilter(overlay).toggle();
                    }).up()
                .up()
                // ── Ruler readout (hidden until the ruler tool is toggled on) ──
                .addDiv({ id: 'yawo-ruler', class: 'yawo-ruler yawo-hidden' })
                    .addSpan({ id: 'yawo-ruler-text', class: 'yawo-ruler-text' }).up()
                .up()
            .up()
            .addWindowFooter({
                version: this.version,
                buttons: [
                    { icon: 'settings', title: 'Settings', onClick: () => this.settingsManager.toggle() },
                    { icon: 'palette', title: 'Template Color Converter', onClick: () => window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer') },
                    { icon: 'ruler', title: 'Ruler — measure pixel distance (right-click to reset)', className: 'yawo-chrome-btn yawo-ruler-btn', onClick: () => this.toggleRuler() },
                ],
            })
        .mount(document.body);
        this.updateActiveOverlayName(this.apiManager?.templateManager?.getActiveDisplayName());
        this.applyWindowPosition(document.querySelector(`#${this.windowId}`), this.settingsManager?.settings?.windowPosition);
        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar, #${this.windowId} .yawo-footer`, (x, y) => {
            if (this.settingsManager?.settings) { this.settingsManager.settings.windowPosition = { x, y }; this.settingsManager.persist(); }
        });
        this.enableResizing(
            `#${this.windowId}.yawo-window`,
            (w, h) => { if (this.settingsManager?.settings) { this.settingsManager.settings.windowSize = { w, h }; this.settingsManager.persist(); } },
            this.settingsManager?.settings?.windowSize
        );
        // Restore the persisted compact layout on mount.
        if (this.settingsManager?.settings?.compact) {
            const win = document.querySelector(`#${this.windowId}`);
            const btn = win?.querySelector('.yawo-compact-btn');
            this.#applyCompact(win, btn, true);
        }
    }

    // Toggle the compact layout on the main window, persisting the choice.
    toggleCompact(btn) {
        const win = document.querySelector(`#${this.windowId}`);
        if (!win) return;
        const next = !win.classList.contains('yawo-compact');
        this.#applyCompact(win, btn, next);
        if (this.settingsManager?.settings) {
            this.settingsManager.settings.compact = next;
            this.settingsManager.persist();
        }
        this.setStatus(next ? 'Compact view enabled!' : 'Compact view disabled!');
    }

    // Sync the window's compact class and the chrome button's icon/state.
    #applyCompact(win, btn, compact) {
        if (!win) return;
        win.classList.toggle('yawo-compact', compact);
        // Let the new layout dictate height (drop any height frozen by a manual resize).
        win.style.height = '';
        win.classList.remove('yawo-window-resized');
        if (btn) {
            btn.dataset.compactStatus = compact ? 'compact' : 'normal';
            btn.innerHTML = icon(compact ? 'maximize2' : 'minimize2');
            btn.title = compact ? 'Normal view' : 'Compact view';
        }
    }

}
