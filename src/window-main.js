import { Overlay } from './overlay.js';
import { WindowColorFilter } from './window-filter.js';

export class WindowMain extends Overlay {
    constructor(name, version) {
        super(name, version);
        this.windowId = 'yawo-window-main';
    }

    updateActiveOverlayName(name) {
        this.setElementContent('yawo-active-overlay', name ?? '—');
    }

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            this.setError('Main window already exists!');
            return;
        }
        this.addDiv({ id: this.windowId, class: 'yawo-window yawo-compact', style: 'top: 10px; left: unset; right: 75px;' })
            .addTitleBar()
                .addButton({ class: 'yawo-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Yet Another Wplace Overlay"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                    btn.onclick    = () => overlay.toggleMinimize(btn);
                    btn.ontouchend = () => btn.click();
                }).up()
                .addHeading(1, { textContent: this.name, style: 'font-size:11px; font-weight:600; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;' }).up()
            .up()
            .addDiv({ class: 'yawo-content' })
                .addDiv({ class: 'yawo-stat-grid' })
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSmall({ textContent: '💧 Droplets', class: 'yawo-stat-label' }).up()
                        .addSpan({ id: 'yawo-droplets', class: 'yawo-stat-value' }).up()
                    .up()
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSmall({ textContent: '⚡ Charges', class: 'yawo-stat-label' }).up()
                        .addCountdownTimer(Date.now(), 1000, { class: 'yawo-stat-value' }, (overlay, timerEl) => {
                            if (overlay.apiManager) overlay.apiManager.chargesTimerId = timerEl.id;
                        }).up()
                    .up()
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSmall({ textContent: '📈 Next level', class: 'yawo-stat-label' }).up()
                        .addSpan({ id: 'yawo-next-level', class: 'yawo-stat-value' }).up()
                    .up()
                    .addDiv({ class: 'yawo-stat-cell' })
                        .addSmall({ textContent: '🗂️ Active overlay', class: 'yawo-stat-label' }).up()
                        .addSpan({ id: 'yawo-active-overlay', class: 'yawo-stat-value', style: 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;' }).up()
                    .up()
                .up()
                .addHr().up()
                .addDiv({ class: 'yawo-col yawo-wrap yawo-action-btns' })
                    .addButton({ innerHTML: '🚫 Disable', 'data-button-status': 'shown' }, (overlay, btn) => {
                        btn.onclick = () => {
                            btn.disabled = true;
                            if (btn.dataset.buttonStatus === 'shown') {
                                overlay.apiManager?.templateManager?.setEnabled(false);
                                btn.dataset.buttonStatus = 'hidden';
                                btn.innerHTML = '✅ Enable';
                                overlay.setStatus('Disabled templates!');
                            } else {
                                overlay.apiManager?.templateManager?.setEnabled(true);
                                btn.dataset.buttonStatus = 'shown';
                                btn.innerHTML = '🚫 Disable';
                                overlay.setStatus('Enabled templates!');
                            }
                            btn.disabled = false;
                        };
                    }).up()
                    .addButton({ innerHTML: '📋 Overlays' }, (overlay, btn) => {
                        btn.onclick = () => overlay.apiManager?.templateManager?.windowTemplateSelect?.toggle();
                    }).up()
                    .addButton({ innerHTML: '🎨 Filter', 'data-yawo-filter': '1' }, (overlay, btn) => {
                        btn.onclick = () => new WindowColorFilter(overlay).toggle();
                    }).up()
                .up()
                .addDiv({ class: 'yawo-col' })
                    .addTextarea({ id: 'yawo-status', placeholder: `Status: Sleeping...\nVersion: ${this.version}`, readOnly: true, class: 'yawo-status-area' }).up()
                .up()
                .addDiv({ class: 'yawo-col yawo-wrap', style: 'margin-bottom: 0; flex-direction: column;' })
                    .addDiv({ class: 'yawo-wrap' })
                        .addButton({ class: 'yawo-chrome-btn', innerHTML: '⚙️', title: 'Settings' }, (overlay, btn) => {
                            btn.onclick = () => overlay.settingsManager.toggle();
                        }).up()
                        .addButton({ class: 'yawo-chrome-btn', innerHTML: '🎨', title: 'Template Color Converter' }, (overlay, btn) => {
                            btn.onclick = () => window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer');
                        }).up()
                    .up()
                .up()
            .up()
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
