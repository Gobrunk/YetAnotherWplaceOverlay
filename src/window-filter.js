import { Overlay } from './overlay.js';
import { ConfettiManager } from './confetti.js';
import { rgbToHex, calculateLuminance, formatNumber, formatPercent, formatDate } from './utils.js';

export class WindowColorFilter extends Overlay {
    constructor(ctx) {
        super(ctx.name, ctx.version);
        this.windowId        = 'yawo-window-filter';
        this.listContainerId = 'yawo-filter-list';
        this.mountTarget     = document.body;
        this.templateManager = ctx.apiManager?.templateManager ?? ctx;
        this.settingsManager = ctx.settingsManager ?? null;

        const { palette } = this.templateManager.paletteCache;
        this.palette        = palette;
        this.tilesChecked   = 0;
        this.totalTiles     = 0;
        this.totalByColor   = new Map();
        this.correctByColor = new Map();
        this.correctTotal   = 0;
        this.pixelsTotal    = 0;
        this.timeRemaining  = 0;
        this.formattedEta   = '';
        this.sortPrimary    = 'id';
        this.sortSecondary  = 'ascending';
        this.showUnused     = false;

        this.#eyeShownSvg  = '<svg viewBox="0 0 .5 6 3"><path d="M0,2Q3-1 6,2Q3,5 0,2H2A1,1 0 1 0 3,1Q3,2 2,2"/></svg>';
        this.#eyeHiddenSvg = '<svg viewBox="0 1 12 6"><mask id="a"><path d="M0,0H12V8L0,2" fill="#fff"/></mask><path d="M0,4Q6-2 12,4Q6,10 0,4H4A2,2 0 1 0 6,2Q6,4 4,4ZM1,2L10,6.5L9.5,7L.5,2.5" mask="url(#a)"/></svg>';
    }

    #eyeShownSvg  = '';
    #eyeHiddenSvg = '';

    toggle() {
        const existing = document.querySelector('#yawo-color-dropdown');
        if (existing) { existing._cleanup?.(); existing.remove(); return; }

        const anchor = document.querySelector('[data-yawo-filter="1"]');
        if (!anchor) return;

        const { palette: pal } = this.templateManager.paletteCache;

        // Ordre du jeu : lit la position des éléments #color-N dans le DOM de la palette
        const gameOrderMap = new Map();
        document.querySelectorAll('[id^="color-"]').forEach((el, idx) => {
            const id = parseInt(el.id.slice(6), 10);
            if (!isNaN(id)) gameOrderMap.set(id, idx);
        });
        const sortedPal = gameOrderMap.size > 0
            ? [...pal].sort((a, b) => (gameOrderMap.get(a.id) ?? 9999) - (gameOrderMap.get(b.id) ?? 9999))
            : pal;

        let totalPixels = 0;
        const ieMap = new Map(), neMap = new Map();
        const activeKey = this.templateManager.activeTemplateKey;
        const visibleTemplates = activeKey
            ? this.templateManager.templates.filter(t => `${t.sortId} ${t.authorId}` === activeKey)
            : this.templateManager.templates;
        for (const tmpl of visibleTemplates) {
            totalPixels += tmpl.pixelStats?.total ?? 0;
            const colors = tmpl.pixelStats?.colors ?? new Map();
            for (const [cid, cnt] of colors) ieMap.set(cid, (ieMap.get(cid) ?? 0) + Number(cnt));
            const corr = tmpl.pixelStats?.correct ?? {};
            for (const tileCorr of Object.values(corr))
                for (const [cid, cnt] of tileCorr) neMap.set(cid, (neMap.get(cid) ?? 0) + Number(cnt));
        }

        // ── Solo Mode ─────────────────────────────────────────
        if (this.templateManager._soloMode === undefined) this.templateManager._soloMode = false;

        const getSelectedGameColor = () => {
            for (const el of document.querySelectorAll('[id^="color-"]')) {
                const id = parseInt(el.id.slice(6), 10);
                if (isNaN(id) || id <= 0) continue;
                if (el.classList.contains('btn-active') || el.classList.contains('selected') || el.classList.contains('active') ||
                    el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' ||
                    [...el.classList].some(c => /^ring/.test(c) || /^outline/.test(c)))
                    return id;
            }
            return null;
        };

        const applySolo = colorId => {
            if (colorId === null) return;
            for (const c of pal) { if (c.id > 0) this.templateManager.hiddenColors.set(c.id, true); }
            this.templateManager.hiddenColors.delete(colorId);
            document.querySelectorAll('#yawo-color-dropdown [data-color-id]').forEach(row => {
                const rid  = parseInt(row.dataset.colorId, 10);
                const eye  = row.querySelector('.yawo-eye-toggle');
                const shown = rid === colorId;
                if (eye) { eye.dataset.state = shown ? 'shown' : 'hidden'; eye.style.opacity = shown ? '0.72' : '0.28'; }
                row.style.opacity = shown ? '1' : '0.38';
            });
        };

        const startSoloObs = () => {
            if (this.templateManager._soloObs) return;
            const palRoot = document.querySelector('[id^="color-"]')?.parentNode ?? document.body;
            let lastId = null;
            this.templateManager._soloObs = new MutationObserver(() => {
                const id = getSelectedGameColor();
                if (id !== null && id !== lastId) { lastId = id; applySolo(id); }
            });
            this.templateManager._soloObs.observe(palRoot, {
                attributes: true, subtree: true, attributeFilter: ['class', 'aria-pressed', 'aria-selected', 'style']
            });
            const id = getSelectedGameColor();
            if (id !== null) { lastId = id; applySolo(id); }
        };

        const stopSoloObs = () => {
            this.templateManager._soloObs?.disconnect();
            this.templateManager._soloObs = null;
        };

        if (this.templateManager._soloMode) startSoloObs();

        // ── Window wrapper ────────────────────────────────────
        const wrap = document.createElement('div');
        wrap.id = 'yawo-color-dropdown';
        wrap.classList.add('yawo-window');
        wrap.style.cssText = `width:380px; z-index:9999;`;
        wrap._cleanup = stopSoloObs;

        // ── Titlebar ──────────────────────────────────────────
        const titlebar = document.createElement('div');
        titlebar.className = 'yawo-titlebar';

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'yawo-chrome-btn';
        minimizeBtn.textContent = '▼';
        minimizeBtn.dataset.buttonStatus = 'expanded';
        minimizeBtn.setAttribute('aria-label', 'Minimize window "Color Filter"');
        minimizeBtn.onclick    = () => this.toggleMinimize(minimizeBtn);
        minimizeBtn.ontouchend = () => minimizeBtn.click();

        const shownCount = sortedPal.filter(p => p.id > 0 && (ieMap.get(p.id) ?? 0) > 0).length;
        const titleEl = document.createElement('div');
        titleEl.textContent = `Couleurs (${shownCount})`;

        const mkBtn = (label, bg, fg, onclick) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `background:${bg}; border:1px solid ${fg}44; color:${fg}; border-radius:5px; padding:3px 6px; font-size:11px; cursor:pointer; transition:background .12s;`;
            btn.onmouseenter = () => { btn.style.background = bg.replace(/[\d.]+\)$/, m => (parseFloat(m) * 2.5) + ')') || bg; };
            btn.onmouseleave = () => { btn.style.background = bg; };
            btn.onclick = onclick;
            return btn;
        };

        // Bouton Solo
        const soloOnBg  = 'rgba(251,191,36,.25)', soloOnFg  = 'rgba(251,191,36,1)';
        const soloOffBg = 'rgba(255,255,255,.08)', soloOffFg = 'rgba(255,255,255,.6)';
        const soloBtn = document.createElement('button');
        soloBtn.title = 'Afficher uniquement la couleur sélectionnée sur Wplace';
        const refreshSoloBtnStyle = () => {
            const on = this.templateManager._soloMode;
            soloBtn.textContent = '◎ Solo';
            soloBtn.style.cssText = `background:${on ? soloOnBg : soloOffBg}; border:1px solid ${on ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.15)'}; color:${on ? soloOnFg : soloOffFg}; border-radius:5px; padding:3px 6px; font-size:11px; cursor:pointer; transition:all .12s; font-weight:${on ? '600' : '400'};`;
        };
        refreshSoloBtnStyle();
        soloBtn.onclick = () => {
            this.templateManager._soloMode = !this.templateManager._soloMode;
            this.templateManager.saveFilterState();
            refreshSoloBtnStyle();
            if (this.templateManager._soloMode) {
                startSoloObs();
            } else {
                stopSoloObs();
                this.templateManager.hiddenColors.clear();
                this.templateManager.saveFilterState();
                document.querySelectorAll('#yawo-color-dropdown [data-color-id]').forEach(row => {
                    const eye = row.querySelector('.yawo-eye-toggle');
                    if (eye) { eye.dataset.state = 'shown'; eye.style.opacity = '0.72'; }
                    row.style.opacity = '1';
                });
            }
        };

        // Span pour éviter le style .yawo-titlebar > div (flex:1) sur le groupe de boutons
        const btnGroup = document.createElement('span');
        btnGroup.style.cssText = `display:flex; gap:4px; align-items:center; flex-shrink:0;`;
        btnGroup.appendChild(soloBtn);
        btnGroup.appendChild(mkBtn('✓ All',  'rgba(74,222,128,.15)',  'rgba(74,222,128,.9)',  () => { this.templateManager.hiddenColors.clear(); this.templateManager.saveFilterState(); wrap.remove(); this.toggle(); }));
        btnGroup.appendChild(mkBtn('✗ None', 'rgba(248,113,113,.15)', 'rgba(248,113,113,.9)', () => { for (const c of pal) { if (c.id > 0) this.templateManager.hiddenColors.set(c.id, true); } this.templateManager.saveFilterState(); wrap.remove(); this.toggle(); }));
        btnGroup.appendChild(mkBtn('↻',      'rgba(255,255,255,.08)', 'rgba(255,255,255,.7)', () => { wrap.remove(); this.templateManager.refreshCorrectStats().then(() => this.toggle()); }));

        const closeBtn = document.createElement('button');
        closeBtn.className = 'yawo-chrome-btn';
        closeBtn.textContent = '✖';
        closeBtn.setAttribute('aria-label', 'Close window "Color Filter"');
        closeBtn.onclick    = () => { stopSoloObs(); wrap.remove(); };
        closeBtn.ontouchend = () => closeBtn.click();

        titlebar.appendChild(minimizeBtn);
        titlebar.appendChild(titleEl);
        titlebar.appendChild(btnGroup);
        titlebar.appendChild(closeBtn);
        wrap.appendChild(titlebar);

        // ── Content ───────────────────────────────────────────
        const content = document.createElement('div');
        content.className = 'yawo-content';
        content.style.cssText = `padding:4px 0; gap:0;`;

        // ── Liste scrollable ──────────────────────────────────
        const list = document.createElement('div');
        list.style.cssText = `max-height:340px; overflow-y:auto; padding:4px 0;`;

        for (const color of sortedPal) {
            if (color.id <= 0) continue;
            const total   = ieMap.get(color.id) ?? 0;
            if (total === 0) continue;
            const correct = neMap.get(color.id) ?? 0;
            const pct     = total > 0 ? Math.round(correct / total * 100) : 0;
            const [r, g, b] = color.rgb;
            const isHidden  = !!this.templateManager.hiddenColors.get(color.id);

            const row = document.createElement('div');
            row.dataset.colorId = color.id;
            row.style.cssText = `display:flex; align-items:center; gap:8px; padding:5px 10px; opacity:${isHidden ? '0.4' : '1'}; transition:opacity .15s;`;
            row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,.05)'; };
            row.onmouseleave = () => { row.style.background = ''; };

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'yawo-eye-toggle';
            toggleBtn.dataset.state = isHidden ? 'hidden' : 'shown';
            toggleBtn.title = isHidden ? `Afficher ${color.name} sur l'overlay` : `Masquer ${color.name} de l'overlay`;
            toggleBtn.style.cssText = `background:none; border:none; cursor:pointer; padding:0; font-size:13px; flex-shrink:0; line-height:1; opacity:${isHidden ? '0.3' : '0.8'}; transition:opacity .15s;`;
            toggleBtn.textContent = '👁';
            toggleBtn.onclick = ev => {
                ev.stopPropagation();
                if (toggleBtn.dataset.state === 'shown') {
                    this.templateManager.hiddenColors.set(color.id, true);
                    this.templateManager.saveFilterState();
                    toggleBtn.dataset.state  = 'hidden';
                    toggleBtn.style.opacity  = '0.3';
                    toggleBtn.title          = `Afficher ${color.name} sur l'overlay`;
                    row.style.opacity        = '0.4';
                } else {
                    this.templateManager.hiddenColors.delete(color.id);
                    this.templateManager.saveFilterState();
                    toggleBtn.dataset.state  = 'shown';
                    toggleBtn.style.opacity  = '0.8';
                    toggleBtn.title          = `Masquer ${color.name} de l'overlay`;
                    row.style.opacity        = '1';
                }
            };

            const swatch = document.createElement('div');
            swatch.style.cssText = `width:14px; height:14px; flex-shrink:0; border-radius:3px; background:rgb(${r},${g},${b}); border:1px solid rgba(255,255,255,.15);`;

            const nameEl = document.createElement('span');
            nameEl.style.cssText = `flex:1; color:rgba(255,255,255,.85);`;
            nameEl.textContent = color.name;

            const barColor = pct >= 80 ? '#22c55e' : pct >= 40 ? '#facc15' : '#f87171';

            const barWrap = document.createElement('div');
            barWrap.style.cssText = `width:100px; height:16px; background:rgba(255,255,255,.1); border-radius:3px; flex-shrink:0; position:relative; overflow:hidden;`;
            const bar = document.createElement('div');
            bar.style.cssText = `height:100%; border-radius:3px; background:${barColor}; width:${pct}%;`;
            const barLabel = document.createElement('span');
            barLabel.style.cssText = `position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:9px; color:#fff; background:rgba(0,0,0,.35); pointer-events:none; white-space:nowrap;`;
            barLabel.textContent = `${formatNumber(correct)} / ${formatNumber(total)}`;
            barWrap.appendChild(bar);
            barWrap.appendChild(barLabel);

            const statsEl = document.createElement('span');
            statsEl.style.cssText = `color:${barColor}; font-size:11px; white-space:nowrap; width:36px; flex-shrink:0; text-align:right; font-weight:600;`;
            statsEl.textContent = `${pct}%`;

            row.appendChild(toggleBtn);
            row.appendChild(swatch);
            row.appendChild(nameEl);
            row.appendChild(barWrap);
            row.appendChild(statsEl);
            list.appendChild(row);
        }
        content.appendChild(list);
        wrap.appendChild(content);
        document.body.appendChild(wrap);

        // ── Position : restaure la sauvegarde ou se place sous l'ancre ──
        const savedPos = this.settingsManager?.settings?.filterWindowPosition;
        if (savedPos?.x !== undefined && savedPos?.y !== undefined) {
            wrap.style.transform = `translate(${savedPos.x}px, ${savedPos.y}px)`;
            wrap.style.left = '0px';
            wrap.style.top  = '0px';
        } else {
            const rect = anchor.getBoundingClientRect();
            wrap.style.top  = (rect.bottom + 4) + 'px';
            wrap.style.left = rect.left + 'px';
        }

        // ── Dragging ──────────────────────────────────────────
        this.enableDragging('#yawo-color-dropdown.yawo-window', '#yawo-color-dropdown .yawo-titlebar', (x, y) => {
            if (this.settingsManager?.settings) {
                this.settingsManager.settings.filterWindowPosition = { x, y };
            }
        });
    }

    toggleCompact() {
        if (document.querySelector(`#${this.windowId}`)) {
            document.querySelector(`#${this.windowId}`).remove();
            return;
        }
        this.addDiv({ id: this.windowId, class: 'yawo-window yawo-compact' })
            .addTitleBar()
                .addButton({ class: 'yawo-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Color Filter"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                    btn.onclick = () => {
                        const statsEl = document.querySelector('#yawo-compact-stats');
                        if (statsEl) statsEl.style.display = btn.dataset.buttonStatus === 'expanded' ? 'none' : '';
                        overlay.toggleMinimize(btn);
                    };
                    btn.ontouchend = () => btn.click();
                }).up()
                .addDiv()
                    .addSpan({ id: 'yawo-compact-stats', class: 'yawo-text-bold' }).up()
                .up()
                .addDiv({ class: 'yawo-row' })
                    .addButton({ class: 'yawo-chrome-btn', textContent: '🗖', 'aria-label': 'Switch to fullscreen mode for "Color Filter"' }, (overlay, btn) => {
                        btn.onclick    = () => { document.querySelector(`#${this.windowId}`)?.remove(); this.toggle(); };
                        btn.ontouchend = () => btn.click();
                    }).up()
                    .addButton({ class: 'yawo-chrome-btn', textContent: '✖', 'aria-label': 'Close window "Color Filter"' }, (overlay, btn) => {
                        btn.onclick    = () => document.querySelector(`#${this.windowId}`)?.remove();
                        btn.ontouchend = () => btn.click();
                    }).up()
                .up()
            .up()
            .addDiv({ class: 'yawo-content' })
                .addDiv({ class: 'yawo-col yawo-spaced' })
                    .addHeading(1, { textContent: 'Color Filter' }).up()
                .up()
                .addHr().up()
                .addDiv({ class: 'yawo-col yawo-wrap yawo-spaced', style: 'gap: 1.5ch;' })
                    .addButton({ textContent: 'None' },    (overlay, btn) => { btn.onclick = () => this.#setAllVisibility(false); }).up()
                    .addButton({ textContent: 'Refresh' }, (overlay, btn) => { btn.onclick = () => { btn.disabled = true; this.refreshStats(); btn.disabled = false; }; }).up()
                    .addButton({ textContent: 'All' },     (overlay, btn) => { btn.onclick = () => this.#setAllVisibility(true); }).up()
                .up()
                .addDiv({ class: 'yawo-col yawo-sections' }).up()
            .up()
        .mount(this.mountTarget);
        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar`);

        const sectionsEl = document.querySelector(`#${this.windowId} .yawo-sections`);
        this.#buildColorList(sectionsEl);
        this.#sortColorList(this.sortPrimary, this.sortSecondary, this.showUnused);
    }

    refreshStats() {
        this.#aggregateStats();
        const listEl   = document.querySelector(`#${this.listContainerId}`);
        const statsObj = {};
        for (const color of this.palette) {
            const total   = this.totalByColor.get(color.id) ?? 0;
            const correct = this.correctByColor.get(color.id) ?? 0;
            let correctStr = '0', pctStr = formatPercent(1);
            if (total !== 0) {
                const corrVal = this.correctByColor.get(color.id) ?? '???';
                if (typeof corrVal !== 'number' && this.tilesChecked === this.totalTiles && color.id) {
                    // still calculating
                }
                correctStr = typeof corrVal === 'string' ? corrVal : formatNumber(corrVal);
                pctStr     = isNaN(corrVal / total) ? '???' : formatPercent(corrVal / total);
            }
            const incorrect = parseInt(total) - parseInt(correct);
            statsObj[color.id] = { total, totalStr: formatNumber(total), correct, correctStr, pctStr, incorrect };
        }
        if (document.querySelector('#yawo-compact-stats')) {
            const t = this.correctTotal.toString().length > 7 ? this.correctTotal.toString().slice(0, 2) + '…' + this.correctTotal.toString().slice(-3) : this.correctTotal.toString();
            const e = this.pixelsTotal.toString().length > 7 ? this.pixelsTotal.toString().slice(0, 2) + '…' + this.pixelsTotal.toString().slice(-3) : this.pixelsTotal.toString();
            this.setElementContent('yawo-compact-stats', `${t}/${e}`, true);
        }
        if (!listEl) return statsObj;
        for (const row of Array.from(listEl.children)) {
            const colorId = parseInt(row.dataset.id);
            const { correct, correctStr, pctStr, total, totalStr, incorrect } = statsObj[colorId];
            row.dataset.correct   = Number.isNaN(parseInt(correct)) ? '0' : correct;
            row.dataset.total     = total;
            row.dataset.percent   = pctStr.endsWith('%') ? pctStr.slice(0, -1) : '0';
            row.dataset.incorrect = incorrect || 0;
            const statTextEl = document.querySelector(`#${this.windowId} .yawo-color-row[data-id="${colorId}"] .yawo-stat-text`);
            if (statTextEl) statTextEl.textContent = `${correctStr} / ${totalStr}`;
            const detailEl = document.querySelector(`#${this.windowId} .yawo-color-row[data-id="${colorId}"] .yawo-detail-text`);
            if (detailEl) detailEl.textContent = `${typeof incorrect !== 'number' || isNaN(incorrect) ? '???' : incorrect} incorrect pixel${incorrect === 1 ? '' : 's'}. Completed: ${pctStr}`;
        }
        this.#sortColorList(this.sortPrimary, this.sortSecondary, this.showUnused);
    }

    // ── Méthodes privées ──────────────────────────────────────

    #buildColorList(container) {
        const isCompact = container.closest(`#${this.windowId}`)?.classList.contains('yawo-compact');
        const builder   = new Overlay(this.name, this.version);
        builder.addDiv({ id: this.listContainerId });
        const stats = this.refreshStats();

        for (const color of this.palette) {
            const hexColor = '#' + rgbToHex(color.rgb).toUpperCase();
            const lum      = calculateLuminance(color.rgb);
            let textColor  = 1.05 / (lum + 0.05) > (lum + 0.05) / 0.05 ? 'white' : 'black';
            if (!color.id) textColor = 'transparent';
            const textClass = textColor === 'white' ? 'yawo-text-light' : 'yawo-text-dark';
            const { correct, correctStr, pctStr, total, totalStr, incorrect } = stats[color.id];
            const isHidden = !!this.templateManager.hiddenColors.get(color.id);

            const eyeShownSvg  = this.#eyeShownSvg.replace('<svg', `<svg fill="${textColor}"`);
            const eyeHiddenSvg = this.#eyeHiddenSvg.replace('<svg', `<svg fill="${textColor}"`);

            if (isCompact) {
                const starBg = `background-size: auto 100%; background-repeat: repeat-x; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50,5L79,91L2,39L98,39L21,91' fill='${textColor}' fill-opacity='.1'/></svg>");`;
                builder.addDiv({
                    class: 'yawo-col yawo-color-row yawo-wrap', 'data-id': color.id, 'data-name': color.name,
                    'data-premium': +color.premium, 'data-correct': Number.isNaN(parseInt(correct)) ? '0' : correct,
                    'data-total': total, 'data-percent': pctStr.endsWith('%') ? pctStr.slice(0, -1) : '0', 'data-incorrect': incorrect || 0
                })
                    .addDiv({ class: 'yawo-color-swatch', style: `background-color: rgb(${color.rgb?.map(v => Number(v) || 0).join(',')});${color.premium ? starBg : ''}` })
                        .addButton({
                            class: 'yawo-eye-btn ' + textClass, 'data-state': isHidden ? 'hidden' : 'shown',
                            'aria-label': isHidden ? `Show the color ${color.name || ''} on templates.` : `Hide the color ${color.name || ''} on templates.`,
                            innerHTML: isHidden ? eyeHiddenSvg : eyeShownSvg
                        }, (ov, btn) => {
                            btn.onclick = () => {
                                btn.style.textDecoration = 'none'; btn.disabled = true;
                                if (btn.dataset.state === 'shown') {
                                    btn.innerHTML = eyeHiddenSvg; btn.dataset.state = 'hidden';
                                    btn.ariaLabel = `Show the color ${color.name || ''} on templates.`;
                                    this.templateManager.hiddenColors.set(color.id, true);
                                } else {
                                    btn.innerHTML = eyeShownSvg; btn.dataset.state = 'shown';
                                    btn.ariaLabel = `Hide the color ${color.name || ''} on templates.`;
                                    this.templateManager.hiddenColors.delete(color.id);
                                }
                                btn.disabled = false; btn.style.textDecoration = '';
                            };
                            if (!color.id) btn.disabled = true;
                        }).up()
                    .up()
                    .addSmall({ textContent: `#${color.id.toString().padStart(2, 0)}`, style: `color: ${color.id === -1 || color.id === 0 ? 'white' : textColor}` }).up()
                    .addHeading(2, { textContent: color.name, style: `color: ${color.id === -1 || color.id === 0 ? 'white' : textColor}` }).up()
                    .addSmall({ class: 'yawo-stat-text', textContent: `${correctStr} / ${totalStr}`, style: `color: ${color.id === -1 || color.id === 0 ? 'white' : textColor}; flex: 1 1 auto; text-align: right;` }).up()
                .up();
            } else {
                builder.addDiv({
                    class: 'yawo-col yawo-color-row yawo-wrap', 'data-id': color.id, 'data-name': color.name,
                    'data-premium': +color.premium, 'data-correct': Number.isNaN(parseInt(correct)) ? '0' : correct,
                    'data-total': total, 'data-percent': pctStr.endsWith('%') ? pctStr.slice(0, -1) : '0', 'data-incorrect': incorrect || 0
                })
                    .addDiv({ class: 'yawo-row', style: 'flex-direction: column;' })
                        .addDiv({ class: 'yawo-color-swatch', style: `background-color: rgb(${color.rgb?.map(v => Number(v) || 0).join(',')});` })
                            .addButton({
                                class: 'yawo-eye-btn ' + textClass, 'data-state': isHidden ? 'hidden' : 'shown',
                                'aria-label': isHidden ? `Show the color ${color.name || ''} on templates.` : `Hide the color ${color.name || ''} on templates.`,
                                innerHTML: isHidden ? eyeHiddenSvg : eyeShownSvg
                            }, (ov, btn) => {
                                btn.onclick = () => {
                                    btn.style.textDecoration = 'none'; btn.disabled = true;
                                    if (btn.dataset.state === 'shown') {
                                        btn.innerHTML = eyeHiddenSvg; btn.dataset.state = 'hidden';
                                        btn.ariaLabel = `Show the color ${color.name || ''} on templates.`;
                                        this.templateManager.hiddenColors.set(color.id, true);
                                    } else {
                                        btn.innerHTML = eyeShownSvg; btn.dataset.state = 'shown';
                                        btn.ariaLabel = `Hide the color ${color.name || ''} on templates.`;
                                        this.templateManager.hiddenColors.delete(color.id);
                                    }
                                    btn.disabled = false; btn.style.textDecoration = '';
                                };
                                if (!color.id) btn.disabled = true;
                            }).up()
                        .up()
                        .addSmall({ textContent: color.id === -2 ? '???????' : formatNumber(total) }).up()
                    .up()
                    .addDiv({ class: 'yawo-wrap' })
                        .addHeading(2, { textContent: (color.premium ? '★ ' : '') + color.name }).up()
                        .addDiv({ class: 'yawo-wrap', style: 'gap: 1.5ch;' })
                            .addSmall({ textContent: `#${color.id.toString().padStart(2, 0)}` }).up()
                            .addSmall({ class: 'yawo-stat-text', textContent: `${correctStr} / ${totalStr}` }).up()
                        .up()
                        .addParagraph({ class: 'yawo-detail-text', textContent: `${typeof incorrect !== 'number' || isNaN(incorrect) ? '???' : incorrect} incorrect pixel${incorrect === 1 ? '' : 's'}. Completed: ${pctStr}` }).up()
                    .up()
                .up();
            }
        }
        builder.up().mount(container);
    }

    #sortColorList(primary, secondary, showUnused) {
        this.sortPrimary   = primary;
        this.sortSecondary = secondary;
        this.showUnused    = showUnused;
        const listEl = document.querySelector(`#${this.listContainerId}`);
        if (!listEl) return;
        const rows = Array.from(listEl.children);
        rows.sort((a, b) => {
            const aVal = a.getAttribute('data-' + primary);
            const bVal = b.getAttribute('data-' + primary);
            const aNum = parseFloat(aVal), bNum = parseFloat(bVal);
            const bothNum = !isNaN(aNum) && !isNaN(bNum);
            if (showUnused) a.classList.remove('yawo-hidden');
            else if (!Number(a.getAttribute('data-total'))) a.classList.add('yawo-hidden');
            if (bothNum) return secondary === 'ascending' ? aNum - bNum : bNum - aNum;
            const al = aVal.toLowerCase(), bl = bVal.toLowerCase();
            return al < bl ? (secondary === 'ascending' ? -1 : 1) : al > bl ? (secondary === 'ascending' ? 1 : -1) : 0;
        });
        rows.forEach(row => listEl.appendChild(row));
    }

    #setAllVisibility(show) {
        const listEl = document.querySelector(`#${this.listContainerId}`);
        if (!listEl) return;
        for (const row of Array.from(listEl.children)) {
            if (row.classList.contains('yawo-hidden')) continue;
            const btn = row.querySelector('.yawo-color-swatch button');
            if (!btn) continue;
            if ((btn.dataset.state === 'hidden') === show) btn.click();
        }
    }

    #aggregateStats() {
        this.pixelsTotal    = 0;
        this.correctTotal   = 0;
        this.totalByColor   = new Map();
        this.correctByColor = new Map();
        this.tilesChecked   = 0;
        this.totalTiles     = 0;
        const activeKey2 = this.templateManager.activeTemplateKey;
        const visibleTemplates2 = activeKey2
            ? this.templateManager.templates.filter(t => `${t.sortId} ${t.authorId}` === activeKey2)
            : this.templateManager.templates;
        for (const tmpl of visibleTemplates2) {
            const total = tmpl.pixelStats?.total ?? 0;
            this.pixelsTotal += total;
            const colors = tmpl.pixelStats?.colors ?? new Map();
            for (const [colorId, cnt] of colors) {
                this.totalByColor.set(colorId, (this.totalByColor.get(colorId) ?? 0) + (Number(cnt) || 0));
            }
            const correct = tmpl.pixelStats?.correct ?? {};
            this.tilesChecked += Object.keys(correct).length;
            this.totalTiles   += Object.keys(tmpl.tiles ?? {}).length;
            for (const tileCorr of Object.values(correct)) {
                for (const [colorId, cnt] of tileCorr) {
                    const val = Number(cnt) || 0;
                    this.correctTotal += val;
                    this.correctByColor.set(colorId, (this.correctByColor.get(colorId) ?? 0) + val);
                }
            }
        }
        if (this.correctTotal >= this.pixelsTotal && this.pixelsTotal && this.tilesChecked === this.totalTiles) {
            new ConfettiManager().launch(document.querySelector(`#${this.windowId}`));
        }
        this.timeRemaining = new Date(30 * (this.pixelsTotal - this.correctTotal) * 1000 + Date.now());
        this.formattedEta  = formatDate(this.timeRemaining);
    }
}
