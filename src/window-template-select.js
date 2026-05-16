import { Overlay } from './overlay.js';

export class WindowTemplateSelect extends Overlay {
    #ctx            = null;
    listContainerId = 'yawo-template-list';
    windowId        = 'yawo-window-template-select';

    constructor(name, version) {
        super(name, version);
    }

    setCtx(ctx) { this.#ctx = ctx; }

    toggle() {
        const existing = document.querySelector(`#${this.windowId}`);
        if (existing) { existing.remove(); return; }

        this.addDiv({ id: this.windowId, class: 'yawo-window', style: 'top: 10px; left: 10px; width: 300px;' })
            .addTitleBar()
                .addButton({ class: 'yawo-chrome-btn', textContent: '▼', 'aria-label': 'Minimize', 'data-button-status': 'expanded' }, (overlay, btn) => {
                    btn.onclick    = () => overlay.toggleMinimize(btn);
                    btn.ontouchend = () => btn.click();
                }).up()
                .addHeading(1, { textContent: 'Overlays', style: 'font-size:11px; font-weight:600; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;' }).up()
                .addButton({ class: 'yawo-chrome-btn', textContent: '✕', title: 'Fermer' }, (overlay, btn) => {
                    btn.onclick    = () => document.querySelector(`#${this.windowId}`)?.remove();
                    btn.ontouchend = () => btn.click();
                }).up()
            .up()
            .addDiv({ class: 'yawo-content' })
                .addDiv({ id: this.listContainerId, class: 'yawo-col' }).up()
                .addHr().up()
                .addDetails({ class: 'yawo-add-section' })
                    .addSummary({ innerHTML: '➕&thinsp;Ajouter un overlay' }).up()
                    .addDiv({ class: 'yawo-add-body' })
                        .addDiv({ class: 'yawo-coords-block' })
                            .addDiv({ class: 'yawo-coords-header' })
                                .addSmall({ textContent: 'Position', class: 'yawo-form-label' }).up()
                                .addButton({ class: 'yawo-chrome-btn yawo-jump-btn', innerHTML: '<svg viewBox="0 0 4 6"><path d="M.5,3.4A2,2 0 1 1 3.5,3.4L2,6"/><circle cx="2" cy="2" r=".7" fill="#fff"/></svg>', title: 'Copier les coords du dernier clic' }, (overlay, btn) => {
                                    btn.onclick = () => {
                                        const coords = this.#ctx?.apiManager?.lastClickCoords;
                                        if (coords?.[0]) {
                                            overlay.setElementContent('yawo-ts-tile-x',  coords?.[0] || '');
                                            overlay.setElementContent('yawo-ts-tile-y',  coords?.[1] || '');
                                            overlay.setElementContent('yawo-ts-pixel-x', coords?.[2] || '');
                                            overlay.setElementContent('yawo-ts-pixel-y', coords?.[3] || '');
                                        } else {
                                            this.#ctx?.setError('Coordinates are malformed! Did you try clicking on the canvas first?');
                                        }
                                    };
                                }).up()
                            .up()
                            .addDiv({ class: 'yawo-coords-grid' })
                                .addSmall({ textContent: 'Tile', class: 'yawo-form-label' }).up()
                                .addInput({ type: 'number', id: 'yawo-ts-tile-x',  class: 'yawo-coord-input', placeholder: 'X', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                    inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                                }).up()
                                .addInput({ type: 'number', id: 'yawo-ts-tile-y',  class: 'yawo-coord-input', placeholder: 'Y', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                    inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                                }).up()
                                .addSmall({ textContent: 'Pixel', class: 'yawo-form-label' }).up()
                                .addInput({ type: 'number', id: 'yawo-ts-pixel-x', class: 'yawo-coord-input', placeholder: 'X', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                    inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                                }).up()
                                .addInput({ type: 'number', id: 'yawo-ts-pixel-y', class: 'yawo-coord-input', placeholder: 'Y', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                    inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                                }).up()
                            .up()
                        .up()
                        .addHr().up()
                        .addSmall({ textContent: 'Image', class: 'yawo-form-label' }).up()
                        .addFileInput({ class: 'yawo-file-upload', textContent: 'Choisir un fichier…', accept: 'image/png, image/jpeg, image/webp, image/bmp, image/gif' }, (overlay, _wrapper, inputEl, buttonEl) => {
                            buttonEl.style.cssText += 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                            inputEl.addEventListener('change', () => {
                                buttonEl.title = inputEl.files[0]?.name || '';
                                const nameInp = document.querySelector('#yawo-ts-name');
                                if (nameInp && inputEl.files[0]) {
                                    nameInp.value = inputEl.files[0].name.replace(/\.[^/.]+$/, '').slice(0, 25);
                                }
                            });
                        })
                        .addSmall({ textContent: 'Nom', class: 'yawo-form-label' }).up()
                        .addInput({ type: 'text', id: 'yawo-ts-name', class: 'yawo-rename-input', placeholder: 'Nom (optionnel)', maxlength: 25 }).up()
                        .addButton({ innerHTML: '🖼️&thinsp;Ajouter', class: 'yawo-btn-create' }, (overlay, btn) => {
                            btn.onclick = () => {
                                const fileInput = document.querySelector(`#${this.windowId} input.yawo-file-upload[type="file"]`);
                                const nameInp   = document.querySelector('#yawo-ts-name');
                                const tileXInp  = document.querySelector('#yawo-ts-tile-x');
                                const tileYInp  = document.querySelector('#yawo-ts-tile-y');
                                const pixelXInp = document.querySelector('#yawo-ts-pixel-x');
                                const pixelYInp = document.querySelector('#yawo-ts-pixel-y');
                                if (!tileXInp.checkValidity())  { tileXInp.reportValidity();  return; }
                                if (!tileYInp.checkValidity())  { tileYInp.reportValidity();  return; }
                                if (!pixelXInp.checkValidity()) { pixelXInp.reportValidity(); return; }
                                if (!pixelYInp.checkValidity()) { pixelYInp.reportValidity(); return; }
                                if (fileInput?.files[0]) {
                                    const fallbackName = fileInput.files[0].name.replace(/\.[^/.]+$/, '').slice(0, 25);
                                    const overlayName  = nameInp?.value.trim() || fallbackName;
                                    this.#ctx?.apiManager?.templateManager?.createTemplate(
                                        fileInput.files[0],
                                        overlayName,
                                        [Number(tileXInp.value), Number(tileYInp.value), Number(pixelXInp.value), Number(pixelYInp.value)]
                                    );
                                } else {
                                    this.#ctx?.setError('No file selected!');
                                }
                            };
                        }).up()
                    .up()
                .up()
            .up()
        .mount(document.body);

        this.refresh();
        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar`);
    }

    refresh() {
        const container = document.querySelector(`#${this.listContainerId}`);
        if (!container) return;
        container.innerHTML = '';
        this.#buildTemplateList(container);
    }

    // ── Méthodes privées ──────────────────────────────────────

    #buildTemplateList(container) {
        const tm = this.#ctx?.apiManager?.templateManager;
        if (!tm || tm.templates.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'Aucun overlay enregistré.';
            p.style.cssText = 'text-align:center; color:rgba(255,255,255,.4); padding:8px 0; margin:0;';
            container.appendChild(p);
            return;
        }
        for (const tmpl of tm.templates) {
            const key      = `${tmpl.sortId} ${tmpl.authorId}`;
            const isActive = key === tm.activeTemplateKey;
            if (!tmpl.coords && tmpl.tiles) tmpl.inferCoordsFromTiles();

            const card = document.createElement('div');
            card.className = 'yawo-template-card' + (isActive ? ' yawo-template-card--active' : '');

            const info = document.createElement('div');
            info.className = 'yawo-template-info';

            const name = document.createElement('span');
            name.className = 'yawo-text-light';
            name.style.fontWeight = '600';
            name.textContent = (isActive ? '✓ ' : '') + tmpl.displayName;

            const coords = document.createElement('small');
            coords.className = 'yawo-stat-label';
            if (tmpl.coords) {
                coords.textContent = `T:${tmpl.coords[0]},${tmpl.coords[1]}  P:${tmpl.coords[2]},${tmpl.coords[3]}`;
            }

            info.append(name, coords);

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex; gap:4px; flex-shrink:0;';

            const activateBtn = document.createElement('button');
            activateBtn.textContent = isActive ? 'Actif' : 'Activer';
            activateBtn.disabled    = isActive;
            if (isActive) activateBtn.className = 'yawo-btn-success';
            activateBtn.onclick = () => tm.setActiveTemplate(key);

            const renameBtn = document.createElement('button');
            renameBtn.className = 'yawo-btn-rename';
            renameBtn.title     = 'Renommer';
            renameBtn.innerHTML = '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z"/><path d="M8 3l3 3"/></svg>';
            renameBtn.onclick   = () => {
                const input = document.createElement('input');
                input.type      = 'text';
                input.value     = tmpl.displayName;
                input.className = 'yawo-rename-input';
                input.maxLength = 25;
                name.replaceWith(input);
                input.focus();
                input.select();
                let cancelled = false;
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
                    if (e.key === 'Escape') { cancelled = true; input.blur(); }
                });
                input.addEventListener('blur', () => {
                    if (cancelled) { input.replaceWith(name); return; }
                    const newName = input.value.trim() || tmpl.displayName;
                    tm.renameTemplate(key, newName);
                });
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'yawo-btn-danger';
            deleteBtn.title     = 'Supprimer';
            deleteBtn.innerHTML = '<svg viewBox="0 0 14 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4h12M5 4V2h4v2M3 4l1 10h6l1-10M6 7v4M8 7v4"/></svg>';
            deleteBtn.onclick   = () => {
                if (confirm(`Supprimer "${tmpl.displayName}" ?`)) tm.deleteTemplate(key);
            };

            btnRow.append(activateBtn, renameBtn, deleteBtn);
            card.append(info, btnRow);
            container.appendChild(card);
        }
    }

    async #handleCoordPaste(overlay, inputEl, event) {
        event.preventDefault();
        let text = '';
        if (event.clipboardData) text = event.clipboardData.getData('text/plain');
        if (!text) await navigator.clipboard.readText().then(t => { text = t; }).catch(() => {});
        if (!text) text = window.clipboardData?.getData('Text') ?? '';
        const nums = text.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
        if (nums.length === 2 && inputEl.id === 'yawo-ts-pixel-x') {
            overlay.setElementContent('yawo-ts-pixel-x', nums[0] || '');
            overlay.setElementContent('yawo-ts-pixel-y', nums[1] || '');
        } else if (nums.length === 1) {
            overlay.setElementContent(inputEl.id, nums[0] || '');
        } else {
            overlay.setElementContent('yawo-ts-tile-x',  nums[0] || '');
            overlay.setElementContent('yawo-ts-tile-y',  nums[1] || '');
            overlay.setElementContent('yawo-ts-pixel-x', nums[2] || '');
            overlay.setElementContent('yawo-ts-pixel-y', nums[3] || '');
        }
    }
}
