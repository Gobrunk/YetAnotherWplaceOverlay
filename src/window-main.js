import { Overlay } from './overlay.js';
import { WindowColorFilter } from './window-filter.js';
import { formatPct } from './utils.js';

// Sync the enable/disable toggle's visual state with the templates' enabled flag.
function applyToggleState(btn, enabled) {
    btn.dataset.buttonStatus = enabled ? 'shown' : 'hidden';
    btn.classList.toggle('yawo-toggle--on', enabled);
    btn.title = enabled ? 'Disable templates' : 'Enable templates';
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
        if (!wrap) return;
        if (!stats) { wrap.style.display = 'none'; return; }
        const { pct, correct, total } = stats;
        wrap.style.display = '';
        const arc   = wrap.querySelector('#yawo-completion-arc');
        const pctEl = wrap.querySelector('#yawo-completion-pct');
        const CIRC  = 2 * Math.PI * 42;
        if (arc) {
            arc.style.strokeDasharray  = `${CIRC}`;
            arc.style.strokeDashoffset = `${CIRC * (1 - Math.min(pct, 100) / 100)}`;
        }
        if (pctEl) pctEl.textContent = `${formatPct(correct, total)}%`;
    }

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            this.setError('Main window already exists!');
            return;
        }
        this.addDiv({ id: this.windowId, class: 'yawo-window yawo-compact', style: 'top: 10px; left: unset; right: 75px;' })
            .addWindowHeader({ title: this.name })
            .addDiv({ class: 'yawo-content' })
                .addDiv({ class: 'yawo-stat-row' })
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSpan({ textContent: '⚡', class: 'yawo-stat-badge yawo-badge-charges' }).up()
                        .addCountdownTimer(Date.now(), 1000, { class: 'yawo-stat-value' }, (overlay, timerEl) => {
                            if (overlay.apiManager) overlay.apiManager.chargesTimerId = timerEl.id;
                        }).up()
                        .addSmall({ textContent: 'Charges', class: 'yawo-stat-label' }).up()
                    .up()
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSpan({ textContent: '💧', class: 'yawo-stat-badge yawo-badge-droplets' }).up()
                        .addSpan({ id: 'yawo-droplets', class: 'yawo-stat-value' }).up()
                        .addSmall({ textContent: 'Droplets', class: 'yawo-stat-label' }).up()
                    .up()
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSpan({ textContent: '📈', class: 'yawo-stat-badge yawo-badge-level' }).up()
                        .addSpan({ id: 'yawo-next-level', class: 'yawo-stat-value' }).up()
                        .addSmall({ textContent: 'Next level', class: 'yawo-stat-label' }).up()
                    .up()
                .up()
                .addDiv({ class: 'yawo-stat-block' })
                    .addDiv({ class: 'yawo-stat-cell yawo-overlay-head' })
                        .addDiv({ class: 'yawo-overlay-name-row' })
                            .addSpan({ class: 'yawo-toggle-spacer', 'aria-hidden': 'true' }).up()
                            .addSpan({ id: 'yawo-active-overlay', class: 'yawo-stat-value yawo-overlay-name', style: 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; flex:1; text-align:center;' }).up()
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
                        .addSmall({ textContent: 'Active overlay', class: 'yawo-stat-label' }).up()
                    .up()
                    .addDiv({ id: 'yawo-completion', class: 'yawo-ring', style: 'display:none;' })
                        .addDiv({ class: 'yawo-ring-svg', innerHTML: `
                            <svg viewBox="0 0 100 100" aria-hidden="true">
                              <circle class="yawo-ring-track" cx="50" cy="50" r="42"/>
                              <circle id="yawo-completion-arc" class="yawo-ring-arc" cx="50" cy="50" r="42"/>
                            </svg>` }).up()
                        .addDiv({ class: 'yawo-ring-center' })
                            .addSpan({ id: 'yawo-completion-pct', class: 'yawo-ring-pct' }).up()
                        .up()
                    .up()
                    .addDiv({ class: 'yawo-overlay-actions' })
                        .addButton({ class: 'yawo-action-btn', innerHTML: '📋 Overlays' }, (overlay, btn) => {
                            btn.onclick = () => overlay.apiManager?.templateManager?.windowTemplateSelect?.toggle();
                        }).up()
                        .addButton({ class: 'yawo-action-btn', innerHTML: '🎨 Filters', 'data-yawo-filter': '1' }, (overlay, btn) => {
                            btn.onclick = () => new WindowColorFilter(overlay).toggle();
                        }).up()
                    .up()
                .up()
            .up()
            .addWindowFooter({
                version: this.version,
                buttons: [
                    { html: '⚙️', title: 'Settings', onClick: () => this.settingsManager.toggle() },
                    { html: '🌈', title: 'Template Color Converter', onClick: () => window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer') },
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
