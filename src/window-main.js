import { Overlay } from './overlay.js';
import { WindowColorFilter } from './window-filter.js';
import { WindowWizard } from './window-wizard.js';
import { consoleLog } from './utils.js';

export class WindowMain extends Overlay {
    constructor(name, version) {
        super(name, version);
        this.windowId = 'bm-window-main';
    }

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            this.setError('Main window already exists!');
            return;
        }
        this.addDiv({ id: this.windowId, class: 'bm-window bm-compact', style: 'top: 10px; left: unset; right: 75px;' })
            .addTitleBar()
                .addButton({ class: 'bm-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Yet Another Wplace Overlay"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                    btn.onclick    = () => overlay.toggleMinimize(btn);
                    btn.ontouchend = () => btn.click();
                }).up()
                .addHeading(1, { textContent: this.name, style: 'font-size:11px; font-weight:600; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;' }).up()
            .up()
            .addDiv({ class: 'bm-content' })
                .addDiv({ class: 'bm-stat-grid' })
                    .addDiv({ class: 'bm-stat-cell' })
                        .addSmall({ textContent: '💧 Droplets', class: 'bm-stat-label' }).up()
                        .addSpan({ id: 'bm-droplets', class: 'bm-stat-value' }).up()
                    .up()
                    .addDiv({ class: 'bm-stat-cell' })
                        .addSmall({ textContent: '⚡ Charges', class: 'bm-stat-label' }).up()
                        .addCountdownTimer(Date.now(), 1000, { class: 'bm-stat-value' }, (overlay, timerEl) => {
                            if (overlay.apiManager) overlay.apiManager.chargesTimerId = timerEl.id;
                        }).up()
                    .up()
                    .addDiv({ class: 'bm-stat-cell bm-stat-full' })
                        .addSmall({ textContent: '📈 Next level', class: 'bm-stat-label' }).up()
                        .addSpan({ id: 'bm-next-level', class: 'bm-stat-value' }).up()
                    .up()
                .up()
                .addHr().up()
                .addDiv({ class: 'bm-col' })
                    .addDiv({ class: 'bm-col' })
                        .addButton({ class: 'bm-chrome-btn bm-jump-btn', style: 'margin-top: 0;', innerHTML: '<svg viewBox="0 0 4 6"><path d="M.5,3.4A2,2 0 1 1 3.5,3.4L2,6"/><circle cx="2" cy="2" r=".7" fill="#fff"/></svg>' }, (overlay, btn) => {
                            btn.onclick = () => {
                                const coords = overlay.apiManager?.lastClickCoords;
                                if (coords?.[0]) {
                                    overlay.setElementContent('bm-tile-x',  coords?.[0] || '');
                                    overlay.setElementContent('bm-tile-y',  coords?.[1] || '');
                                    overlay.setElementContent('bm-pixel-x', coords?.[2] || '');
                                    overlay.setElementContent('bm-pixel-y', coords?.[3] || '');
                                } else {
                                    overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?');
                                }
                            };
                        }).up()
                        .addInput({ type: 'number', id: 'bm-tile-x',  class: 'bm-coord-input', placeholder: 'Tl X', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                            inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                        }).up()
                        .addInput({ type: 'number', id: 'bm-tile-y',  class: 'bm-coord-input', placeholder: 'Tl Y', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                            inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                        }).up()
                        .addInput({ type: 'number', id: 'bm-pixel-x', class: 'bm-coord-input', placeholder: 'Px X', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                            inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                        }).up()
                        .addInput({ type: 'number', id: 'bm-pixel-y', class: 'bm-coord-input', placeholder: 'Px Y', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                            inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                        }).up()
                    .up()
                    .addDiv({ class: 'bm-col' })
                        .addFileInput({ class: 'bm-file-upload', textContent: 'Upload Template', accept: 'image/png, image/jpeg, image/webp, image/bmp, image/gif' }).up()
                    .up()
                    .addDiv({ class: 'bm-col bm-wrap bm-action-btns' })
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
                        .addButton({ innerHTML: '🖼️ Create' }, (overlay, btn) => {
                            btn.onclick = () => {
                                const fileInput = document.querySelector(`#${this.windowId} input.bm-file-upload[type="file"]`);
                                const tileXInp  = document.querySelector('#bm-tile-x');
                                const tileYInp  = document.querySelector('#bm-tile-y');
                                const pixelXInp = document.querySelector('#bm-pixel-x');
                                const pixelYInp = document.querySelector('#bm-pixel-y');
                                if (!tileXInp.checkValidity())  { tileXInp.reportValidity();  return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                if (!tileYInp.checkValidity())  { tileYInp.reportValidity();  return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                if (!pixelXInp.checkValidity()) { pixelXInp.reportValidity(); return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                if (!pixelYInp.checkValidity()) { pixelYInp.reportValidity(); return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                if (fileInput?.files[0]) {
                                    overlay.apiManager?.templateManager.createTemplate(fileInput.files[0], fileInput.files[0]?.name.replace(/\.[^/.]+$/, ''), [Number(tileXInp.value), Number(tileYInp.value), Number(pixelXInp.value), Number(pixelYInp.value)]);
                                    overlay.setStatus('Drew to canvas!');
                                } else {
                                    overlay.setError('No file selected!');
                                }
                            };
                        }).up()
                        .addButton({ innerHTML: '🎨 Filter', 'data-bm-filter': '1' }, (overlay, btn) => {
                            btn.onclick = () => new WindowColorFilter(overlay).toggle();
                        }).up()
                    .up()
                .up()
                .addDiv({ class: 'bm-col' })
                    .addTextarea({ id: 'bm-status', placeholder: `Status: Sleeping...\nVersion: ${this.version}`, readOnly: true, class: 'bm-status-area' }).up()
                .up()
                .addDiv({ class: 'bm-col bm-wrap', style: 'margin-bottom: 0; flex-direction: column;' })
                    .addDiv({ class: 'bm-wrap' })
                        .addButton({ class: 'bm-chrome-btn', innerHTML: '⚙️', title: 'Settings' }, (overlay, btn) => {
                            btn.onclick = () => overlay.settingsManager.toggle();
                        }).up()
                        .addButton({ class: 'bm-chrome-btn', innerHTML: '🧙', title: 'Template Wizard' }, (overlay, btn) => {
                            btn.onclick = () => {
                                const tm = overlay.apiManager?.templateManager;
                                new WindowWizard(this.name, this.version, tm?.schemaVersion, tm).toggle();
                            };
                        }).up()
                        .addButton({ class: 'bm-chrome-btn', innerHTML: '🎨', title: 'Template Color Converter' }, (overlay, btn) => {
                            btn.onclick = () => window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer');
                        }).up()
                    .up()
                .up()
            .up()
        .mount(document.body);
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
        this.enableDragging(`#${this.windowId}.bm-window`, `#${this.windowId} .bm-titlebar`, (x, y) => {
            if (this.settingsManager?.settings) this.settingsManager.settings.windowPosition = { x, y };
        });
    }

    // ── Méthodes privées ──────────────────────────────────────

    async #handleCoordPaste(overlay, inputEl, event) {
        event.preventDefault();
        let text = '';
        if (event.clipboardData) {
            text = event.clipboardData.getData('text/plain');
        }
        if (!text) {
            await navigator.clipboard.readText().then(t => { text = t; }).catch(() => {
                consoleLog('Failed to retrieve clipboard data using navigator! Using fallback methods...');
            });
        }
        if (!text) text = window.clipboardData?.getData('Text') ?? '';
        const nums = text.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
        if (nums.length === 2 && inputEl.id === 'bm-pixel-x') {
            overlay.setElementContent('bm-pixel-x', nums[0] || '');
            overlay.setElementContent('bm-pixel-y', nums[1] || '');
        } else if (nums.length === 1) {
            overlay.setElementContent(inputEl.id, nums[0] || '');
        } else {
            overlay.setElementContent('bm-tile-x',  nums[0] || '');
            overlay.setElementContent('bm-tile-y',  nums[1] || '');
            overlay.setElementContent('bm-pixel-x', nums[2] || '');
            overlay.setElementContent('bm-pixel-y', nums[3] || '');
        }
    }
}
