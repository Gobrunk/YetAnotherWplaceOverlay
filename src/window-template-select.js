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
        if (existing) { this.#cleanPopovers(); existing.remove(); return; }

        const growToFit = () => {
            const win = document.querySelector(`#${this.windowId}`);
            if (!win?.style.height) return;
            const content = win.querySelector('.yawo-content');
            const titlebar = win.querySelector('.yawo-titlebar');
            if (!content || !titlebar) return;
            const available = win.offsetHeight - titlebar.offsetHeight;
            if (content.scrollHeight > available) {
                const newH = content.scrollHeight + titlebar.offsetHeight + 2;
                win.style.height = newH + 'px';
                win.classList.add('yawo-window-resized');
                if (this.settingsManager?.settings) {
                    this.settingsManager.settings.templateWindowSize = { w: win.offsetWidth, h: newH };
                    this.settingsManager.persist();
                }
            }
        };

        this.addDiv({ id: this.windowId, class: 'yawo-window', style: 'top: 10px; left: 10px; width: 300px;' })
            .addWindowHeader({
                title: 'Overlays',
                onClose: () => { this.#cleanPopovers(); document.querySelector(`#${this.windowId}`)?.remove(); },
            })
            .addDiv({ class: 'yawo-content' })
                .addDiv({ id: this.listContainerId, class: 'yawo-col' }).up()
                .addHr().up()
                .addDiv({ class: 'yawo-tab-bar' })
                    .addButton({ id: 'yawo-tab-add', class: 'yawo-tab-btn', innerHTML: '➕&thinsp;Add an overlay' }, (overlay, btn) => {
                        btn.onclick = () => {
                            const win      = document.querySelector(`#${this.windowId}`);
                            const addPanel = win.querySelector('#yawo-add-panel');
                            const impPanel = win.querySelector('#yawo-import-panel');
                            const addTab   = win.querySelector('#yawo-tab-add');
                            const impTab   = win.querySelector('#yawo-tab-import');
                            const isOpen   = addPanel.style.display !== 'none';
                            impPanel.style.display = 'none';
                            impTab.classList.remove('yawo-tab-btn--active');
                            addPanel.style.display = isOpen ? 'none' : '';
                            addTab.classList.toggle('yawo-tab-btn--active', !isOpen);
                            growToFit();
                        };
                    }).up()
                    .addButton({ id: 'yawo-tab-import', class: 'yawo-tab-btn', innerHTML: '📥&thinsp;Import' }, (overlay, btn) => {
                        btn.onclick = () => {
                            const win      = document.querySelector(`#${this.windowId}`);
                            const addPanel = win.querySelector('#yawo-add-panel');
                            const impPanel = win.querySelector('#yawo-import-panel');
                            const addTab   = win.querySelector('#yawo-tab-add');
                            const impTab   = win.querySelector('#yawo-tab-import');
                            const isOpen   = impPanel.style.display !== 'none';
                            addPanel.style.display = 'none';
                            addTab.classList.remove('yawo-tab-btn--active');
                            impPanel.style.display = isOpen ? 'none' : '';
                            impTab.classList.toggle('yawo-tab-btn--active', !isOpen);
                            growToFit();
                        };
                    }).up()
                .up()
                .addDiv({ id: 'yawo-add-panel', class: 'yawo-tab-panel', style: 'display:none;' })
                    .addDiv({ class: 'yawo-coords-block' })
                        .addDiv({ class: 'yawo-coords-header' })
                            .addSmall({ textContent: 'Position', class: 'yawo-form-label' }).up()
                            .addButton({ class: 'yawo-chrome-btn yawo-jump-btn', innerHTML: '<svg viewBox="0 0 4 6"><path d="M.5,3.4A2,2 0 1 1 3.5,3.4L2,6"/><circle cx="2" cy="2" r=".7" fill="#fff"/></svg>', title: 'Copy last click coords' }, (overlay, btn) => {
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
                    .addFileInput({ class: 'yawo-file-upload', textContent: 'Choose a file…', accept: 'image/png, image/jpeg, image/webp, image/bmp, image/gif' }, (overlay, _wrapper, inputEl, buttonEl) => {
                        buttonEl.style.cssText += 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                        inputEl.addEventListener('change', () => {
                            buttonEl.title = inputEl.files[0]?.name || '';
                            const nameInp = document.querySelector('#yawo-ts-name');
                            if (nameInp && inputEl.files[0]) {
                                nameInp.value = inputEl.files[0].name.replace(/\.[^/.]+$/, '').slice(0, 25);
                            }
                        });
                    })
                    .addSmall({ textContent: 'Name', class: 'yawo-form-label' }).up()
                    .addInput({ type: 'text', id: 'yawo-ts-name', class: 'yawo-rename-input', placeholder: 'Name (optional)', maxlength: 25 }).up()
                    .addButton({ innerHTML: '🖼️&thinsp;Add', class: 'yawo-btn-create' }, (overlay, btn) => {
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
                .addDiv({ id: 'yawo-import-panel', class: 'yawo-tab-panel', style: 'display:none;' })
                    .addTextarea({ id: 'yawo-ts-import-code', class: 'yawo-import-textarea', placeholder: 'Paste YAWO:v1:... code here', rows: 3, style: 'width:100%; resize:vertical; box-sizing:border-box;' }).up()
                    .addSmall({ textContent: 'Name', class: 'yawo-form-label' }).up()
                    .addInput({ type: 'text', id: 'yawo-ts-import-name', class: 'yawo-rename-input', placeholder: 'Name (optional)', maxlength: 25 }).up()
                    .addButton({ innerHTML: '📥&thinsp;Import', class: 'yawo-btn-create' }, (overlay, btn) => {
                        btn.onclick = async () => {
                            const code = document.querySelector('#yawo-ts-import-code')?.value?.trim();
                            const name = document.querySelector('#yawo-ts-import-name')?.value?.trim();
                            if (!code) { this.#ctx?.setError('No code provided!'); return; }
                            try {
                                await this.#ctx?.apiManager?.templateManager?.importFromShareCode(code, name);
                            } catch (e) {
                                this.#ctx?.setError('Import failed: ' + e.message);
                            }
                        };
                    }).up()
                .up()
            .up()
            .addWindowFooter({ version: this.version })
        .mount(document.body);

        const win = document.querySelector(`#${this.windowId}`);
        const savedPos = this.settingsManager?.settings?.templateWindowPosition;
        if (savedPos?.x !== undefined && savedPos?.y !== undefined) {
            win.style.transform = `translate(${savedPos.x}px, ${savedPos.y}px)`;
            win.style.left = '0px';
            win.style.top  = '0px';
        }

        this.refresh();
        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar`, (x, y) => {
            if (this.settingsManager?.settings) {
                this.settingsManager.settings.templateWindowPosition = { x, y };
                this.settingsManager.persist();
            }
        });
        this.enableResizing(
            `#${this.windowId}.yawo-window`,
            (w, h) => { if (this.settingsManager?.settings) { this.settingsManager.settings.templateWindowSize = { w, h }; this.settingsManager.persist(); } },
            this.settingsManager?.settings?.templateWindowSize
        );
    }

    refresh() {
        this.#cleanPopovers();
        const container = document.querySelector(`#${this.listContainerId}`);
        if (!container) return;
        container.innerHTML = '';
        this.#buildTemplateList(container);
    }

    // ── Private methods ───────────────────────────────────────

    #cleanPopovers() {
        document.querySelectorAll('.yawo-more-popover').forEach(p => p.remove());
    }

    #buildTemplateList(container) {
        const tm = this.#ctx?.apiManager?.templateManager;
        if (!tm || tm.templates.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No saved overlay.';
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
            activateBtn.textContent = isActive ? 'Active' : 'Activate';
            activateBtn.disabled    = isActive;
            if (isActive) activateBtn.className = 'yawo-btn-success';
            activateBtn.onclick = () => tm.setActiveTemplate(key);

            const renameBtn = document.createElement('button');
            renameBtn.className = 'yawo-btn-rename';
            renameBtn.title     = 'Rename';
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
            deleteBtn.title     = 'Delete';
            deleteBtn.innerHTML = '<svg viewBox="0 0 14 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4h12M5 4V2h4v2M3 4l1 10h6l1-10M6 7v4M8 7v4"/></svg>';
            deleteBtn.onclick   = () => {
                if (confirm(`Delete "${tmpl.displayName}"?`)) tm.deleteTemplate(key);
            };

            const pinBtn = document.createElement('button');
            pinBtn.className = 'yawo-btn-pin';
            pinBtn.title     = 'Go to anchor pixel';
            pinBtn.disabled  = !tmpl.coords;
            pinBtn.innerHTML = '<svg viewBox="0 0 14 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1a4 4 0 0 1 4 4c0 3-4 9-4 9S3 8 3 5a4 4 0 0 1 4-4z"/><circle cx="7" cy="5" r="1.4" fill="currentColor" stroke="none"/></svg>';
            pinBtn.onclick   = () => this.#ctx?.apiManager?.navigateToCoords(
                tmpl.coords,
                this.settingsManager?.settings?.overlayZoom ?? 12,
                false,
                this.settingsManager?.settings?.overlaySpeed ?? 1.2,
            );

            const shareBtn = document.createElement('button');
            shareBtn.className = 'yawo-btn-share';
            shareBtn.title     = 'Copy share code';
            shareBtn.innerHTML = '<svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="2.5" r="1.5"/><circle cx="10.5" cy="11.5" r="1.5"/><circle cx="3.5" cy="7" r="1.5"/><line x1="5" y1="7" x2="9" y2="3.2"/><line x1="5" y1="7" x2="9" y2="10.8"/></svg>';
            shareBtn.onclick   = async () => {
                try {
                    const code = await tm.generateShareCode(key);
                    await navigator.clipboard.writeText(code);
                    const prev = shareBtn.innerHTML;
                    shareBtn.textContent = '✓';
                    setTimeout(() => { shareBtn.innerHTML = prev; }, 2000);
                } catch (e) {
                    this.#ctx?.setError('Share failed: ' + e.message);
                }
            };

            const popover = document.createElement('div');
            popover.className = 'yawo-more-popover';
            popover.append(pinBtn, shareBtn, renameBtn, deleteBtn);
            document.body.appendChild(popover);

            let hideTimer;
            const moreBtn = document.createElement('button');
            moreBtn.textContent = '›';
            moreBtn.title       = 'More options';
            moreBtn.addEventListener('mouseenter', () => {
                clearTimeout(hideTimer);
                popover.style.display = 'flex';
                const r    = moreBtn.getBoundingClientRect();
                const popH = popover.offsetHeight;
                const popW = popover.offsetWidth;
                popover.style.top  = `${Math.max(0, Math.min(r.top + (r.height - popH) / 2, window.innerHeight - popH))}px`;
                popover.style.left = `${Math.min(r.right + 6, window.innerWidth - popW)}px`;
            });
            moreBtn.addEventListener('mouseleave', () => {
                hideTimer = setTimeout(() => { popover.style.display = 'none'; }, 120);
            });
            popover.addEventListener('mouseenter', () => clearTimeout(hideTimer));
            popover.addEventListener('mouseleave', () => { popover.style.display = 'none'; });

            btnRow.append(activateBtn, moreBtn);
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
