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

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            this.setError('Main window already exists!');
            return;
        }
        this.addDiv({ id: this.windowId, class: 'yawo-window yawo-window-main', style: 'top: 10px; left: unset; right: 75px;' })
            .addWindowHeader({ title: this.name, statusDot: true })
            .addDiv({ class: 'yawo-content' })
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
                // ── Active overlay name + pixel fraction ──
                .addDiv({ class: 'yawo-overlay-title-row' })
                    .addSpan({ id: 'yawo-active-overlay', class: 'yawo-overlay-name' }).up()
                    .addSpan({ id: 'yawo-active-frac', class: 'yawo-overlay-frac yawo-mono', style: 'display:none;' }).up()
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
                // ── Actions ──
                .addDiv({ class: 'yawo-overlay-actions' })
                    .addButton({ class: 'yawo-action-btn', innerHTML: `${icon('layers')}<span>Overlays</span>` }, (overlay, btn) => {
                        btn.onclick = () => overlay.apiManager?.templateManager?.windowTemplateSelect?.toggle();
                    }).up()
                    .addButton({ class: 'yawo-action-btn', innerHTML: `${icon('sliders')}<span>Filters</span>`, 'data-yawo-filter': '1' }, (overlay, btn) => {
                        btn.onclick = () => new WindowColorFilter(overlay).toggle();
                    }).up()
                .up()
            .up()
            .addWindowFooter({
                version: this.version,
                buttons: [
                    { icon: 'settings', title: 'Settings', onClick: () => this.settingsManager.toggle() },
                    { icon: 'palette', title: 'Template Color Converter', onClick: () => window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer') },
                ],
            })
        .mount(document.body);
        this.updateActiveOverlayName(this.apiManager?.templateManager?.getActiveDisplayName());
        const savedPos = this.settingsManager?.settings?.windowPosition;
        if (savedPos?.x !== undefined && savedPos?.y !== undefined) {
            const winEl = document.querySelector(`#${this.windowId}`);
            if (winEl) {
                winEl.style.transform = `translate(${savedPos.x}px, ${savedPos.y}px)`;
                winEl.style.left  = '0px';
                winEl.style.top   = '0px';
                winEl.style.right = '';
            }
        }
        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar`, (x, y) => {
            if (this.settingsManager?.settings) { this.settingsManager.settings.windowPosition = { x, y }; this.settingsManager.persist(); }
        });
        this.enableResizing(
            `#${this.windowId}.yawo-window`,
            (w, h) => { if (this.settingsManager?.settings) { this.settingsManager.settings.windowSize = { w, h }; this.settingsManager.persist(); } },
            this.settingsManager?.settings?.windowSize
        );
    }

}
