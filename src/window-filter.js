import { Overlay } from './overlay.js';
import { formatNumber, formatPct } from './utils.js';

export class WindowColorFilter extends Overlay {
    constructor(ctx) {
        super(ctx.name, ctx.version);
        this.windowId    = 'yawo-window-filter';
        this.mountTarget = document.body;
        this.templateManager = ctx.apiManager?.templateManager ?? ctx;
        this.settingsManager = ctx.settingsManager ?? null;
        this.apiManager      = ctx.apiManager ?? (typeof ctx.navigateToCoords === 'function' ? ctx : null);

        const { palette } = this.templateManager.paletteCache;
        this.palette = palette;
    }

    toggle() {
        const existing = document.querySelector('#yawo-color-dropdown');
        if (existing) { existing._cleanup?.(); existing.remove(); return; }

        const anchor = document.querySelector('[data-yawo-filter="1"]');
        if (!anchor) return;

        const { palette: pal } = this.templateManager.paletteCache;

        // Game order: reads the position of #color-N elements in the palette DOM
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

        // ── Filter + sort state ───────────────────────────────
        let filterMode = this.templateManager._soloMode ? 'solo'
            : this.templateManager.hiddenColors.size === 0 ? 'all' : 'none';
        let sortState = 'id'; // 'id' | 'name-asc' | 'name-desc' | 'pct-desc' | 'pct-asc'

        const applyRowStates = () => {
            document.querySelectorAll('#yawo-color-dropdown [data-color-id]').forEach(row => {
                const rid   = parseInt(row.dataset.colorId, 10);
                const eye   = row.querySelector('.yawo-eye-toggle');
                const shown = !this.templateManager.hiddenColors.get(rid);
                if (eye) {
                    eye.dataset.state = shown ? 'shown' : 'hidden';
                    eye.style.opacity = shown ? '0.8' : '0.3';
                    eye.title = shown ? `Hide ${eye.dataset.name} from the overlay` : `Show ${eye.dataset.name} on the overlay`;
                }
                row.style.opacity = shown ? '1' : '0.4';
            });
        };

        const applySolo = colorId => {
            if (colorId === null) return;
            for (const c of pal) { if (c.id > 0) this.templateManager.hiddenColors.set(c.id, true); }
            this.templateManager.hiddenColors.delete(colorId);
            applyRowStates();
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

        // ── Titlebar (simplified) ─────────────────────────────
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
        titleEl.textContent = `Colors (${shownCount})`;

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '↻';
        refreshBtn.title = 'Refresh stats';
        refreshBtn.style.cssText = `background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); color:rgba(255,255,255,.7); border-radius:5px; padding:3px 6px; font-size:11px; cursor:pointer; flex-shrink:0;`;
        refreshBtn.onclick = () => { wrap.remove(); this.templateManager.refreshCorrectStats().then(() => this.toggle()); };

        const closeBtn = document.createElement('button');
        closeBtn.className = 'yawo-chrome-btn';
        closeBtn.textContent = '✖';
        closeBtn.setAttribute('aria-label', 'Close window "Color Filter"');
        closeBtn.onclick    = () => { stopSoloObs(); wrap.remove(); };
        closeBtn.ontouchend = () => closeBtn.click();

        titlebar.appendChild(minimizeBtn);
        titlebar.appendChild(titleEl);
        titlebar.appendChild(refreshBtn);
        titlebar.appendChild(closeBtn);
        wrap.appendChild(titlebar);

        // ── Content ───────────────────────────────────────────
        const content = document.createElement('div');
        content.className = 'yawo-content';
        content.style.cssText = `padding:4px 0; gap:0;`;

        // ── Search input ──────────────────────────────────────
        const searchWrap = document.createElement('div');
        searchWrap.style.cssText = `padding:4px 8px 2px;`;
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '🔍 Search colors…';
        searchInput.style.cssText = `width:100%; box-sizing:border-box;`;
        searchInput.oninput = () => applyFilter();
        searchWrap.appendChild(searchInput);
        content.appendChild(searchWrap);

        // ── Column headers ────────────────────────────────────
        const STATS_W = 144; // barWrap(100) + gap(8) + statsEl(36)
        const GOTO_W  = 21;

        const headerRow = document.createElement('div');
        headerRow.style.cssText = `display:flex; align-items:center; gap:8px; padding:3px 10px 5px; border-bottom:1px solid rgba(255,255,255,.07);`;

        // Rolling filter button (header above eye icons) — cycles all → none → solo → all
        const filterModeConfig = {
            all:  { icon: '✓', bg: 'rgba(74,222,128,.18)',  border: 'rgba(74,222,128,.4)',  color: 'rgba(74,222,128,.9)',  title: 'All visible — click for None' },
            none: { icon: '✗', bg: 'rgba(248,113,113,.18)', border: 'rgba(248,113,113,.4)', color: 'rgba(248,113,113,.9)', title: 'All hidden — click for Solo' },
            solo: { icon: '◎', bg: 'rgba(251,191,36,.18)',  border: 'rgba(251,191,36,.4)',  color: 'rgba(251,191,36,.9)',  title: 'Solo mode — click for All' },
        };
        const filterBtn = document.createElement('button');
        filterBtn.style.cssText = `border-radius:4px; padding:1px 4px; font-size:11px; cursor:pointer; flex-shrink:0; transition:all .12s; border-width:1px; border-style:solid; font-weight:600;`;
        const refreshFilterBtn = () => {
            const cfg = filterModeConfig[filterMode];
            filterBtn.textContent = cfg.icon;
            filterBtn.style.background   = cfg.bg;
            filterBtn.style.borderColor  = cfg.border;
            filterBtn.style.color        = cfg.color;
            filterBtn.title              = cfg.title;
        };
        refreshFilterBtn();
        filterBtn.onclick = () => {
            filterMode = { all: 'none', none: 'solo', solo: 'all' }[filterMode];
            if (filterMode === 'all') {
                stopSoloObs();
                this.templateManager._soloMode = false;
                this.templateManager.hiddenColors.clear();
            } else if (filterMode === 'none') {
                stopSoloObs();
                this.templateManager._soloMode = false;
                for (const c of pal) { if (c.id > 0) this.templateManager.hiddenColors.set(c.id, true); }
            } else {
                this.templateManager._soloMode = true;
                startSoloObs();
            }
            this.templateManager.saveFilterState();
            refreshFilterBtn();
            applyRowStates();
        };

        // Swatch spacer
        const swatchSpacer = document.createElement('div');
        swatchSpacer.style.cssText = `width:14px; flex-shrink:0;`;

        // Name column header
        const nameArrow = document.createElement('span');
        nameArrow.textContent = '↕';
        nameArrow.style.cssText = `font-size:9px; opacity:0.5;`;
        const nameHdr = document.createElement('span');
        nameHdr.style.cssText = `flex:1; font-size:10px; color:rgba(255,255,255,.4); cursor:pointer; display:flex; align-items:center; gap:3px; user-select:none;`;
        nameHdr.appendChild(document.createTextNode('Name'));
        nameHdr.appendChild(nameArrow);
        nameHdr.onclick = () => {
            sortState = sortState === 'name-asc' ? 'name-desc' : sortState === 'name-desc' ? 'id' : 'name-asc';
            applyFilter();
        };

        // Completion column header
        const statsArrow = document.createElement('span');
        statsArrow.textContent = '↕';
        statsArrow.style.cssText = `font-size:9px; opacity:0.5;`;
        const statsHdr = document.createElement('span');
        statsHdr.style.cssText = `width:${STATS_W}px; flex-shrink:0; font-size:10px; color:rgba(255,255,255,.4); cursor:pointer; display:flex; align-items:center; justify-content:flex-end; gap:3px; user-select:none;`;
        statsHdr.appendChild(document.createTextNode('Completion'));
        statsHdr.appendChild(statsArrow);
        statsHdr.onclick = () => {
            sortState = sortState === 'pct-desc' ? 'pct-asc' : sortState === 'pct-asc' ? 'id' : 'pct-desc';
            applyFilter();
        };

        // Goto spacer
        const gotoSpacer = document.createElement('div');
        gotoSpacer.style.cssText = `width:${GOTO_W}px; flex-shrink:0;`;

        const premiumSpacer = document.createElement('div');
        premiumSpacer.style.cssText = `width:14px; flex-shrink:0;`;

        headerRow.appendChild(filterBtn);
        headerRow.appendChild(swatchSpacer);
        headerRow.appendChild(premiumSpacer);
        headerRow.appendChild(nameHdr);
        headerRow.appendChild(statsHdr);
        headerRow.appendChild(gotoSpacer);
        content.appendChild(headerRow);

        // ── Update header sort arrows ─────────────────────────
        const updateHeaderArrows = () => {
            nameArrow.textContent  = sortState === 'name-asc' ? '↑' : sortState === 'name-desc' ? '↓' : '↕';
            statsArrow.textContent = sortState === 'pct-desc'  ? '↓' : sortState === 'pct-asc'   ? '↑' : '↕';
            const nameActive  = sortState.startsWith('name');
            const statsActive = sortState.startsWith('pct');
            nameHdr.style.color      = nameActive  ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)';
            statsHdr.style.color     = statsActive ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)';
            nameArrow.style.opacity  = nameActive  ? '1' : '0.5';
            statsArrow.style.opacity = statsActive ? '1' : '0.5';
        };

        // ── Liste scrollable ──────────────────────────────────
        const list = document.createElement('div');
        list.className = 'yawo-filter-list';
        list.style.cssText = `overflow-y:auto; padding:4px 0;`;

        const rowData = [];

        for (const color of sortedPal) {
            if (color.id <= 0) continue;
            const total   = ieMap.get(color.id) ?? 0;
            if (total === 0) continue;
            const correct = neMap.get(color.id) ?? 0;
            const pct      = total > 0 ? correct / total * 100 : 0;
            const pctLabel = formatPct(correct, total);
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
            toggleBtn.dataset.name  = color.name;
            toggleBtn.title = isHidden ? `Show ${color.name} on the overlay` : `Hide ${color.name} from the overlay`;
            toggleBtn.style.cssText = `background:none; border:none; cursor:pointer; padding:0; font-size:13px; flex-shrink:0; line-height:1; opacity:${isHidden ? '0.3' : '0.8'}; transition:opacity .15s;`;
            toggleBtn.textContent = '👁';
            toggleBtn.onclick = ev => {
                ev.stopPropagation();
                if (toggleBtn.dataset.state === 'shown') {
                    this.templateManager.hiddenColors.set(color.id, true);
                    this.templateManager.saveFilterState();
                    toggleBtn.dataset.state  = 'hidden';
                    toggleBtn.style.opacity  = '0.3';
                    toggleBtn.title          = `Show ${color.name} on the overlay`;
                    row.style.opacity        = '0.4';
                } else {
                    this.templateManager.hiddenColors.delete(color.id);
                    this.templateManager.saveFilterState();
                    toggleBtn.dataset.state  = 'shown';
                    toggleBtn.style.opacity  = '0.8';
                    toggleBtn.title          = `Hide ${color.name} from the overlay`;
                    row.style.opacity        = '1';
                }
            };

            const swatch = document.createElement('div');
            swatch.style.cssText = `width:14px; height:14px; flex-shrink:0; border-radius:3px; background:rgb(${r},${g},${b}); border:1px solid rgba(255,255,255,.15);`;

            const starEl = document.createElement('span');
            starEl.style.cssText = `font-size:10px; flex-shrink:0; width:14px; text-align:center; color:${color.premium ? 'rgba(251,191,36,.85)' : 'transparent'}; line-height:1;`;
            starEl.textContent = '★';
            if (color.premium) starEl.title = 'Premium color';

            const nameEl = document.createElement('span');
            nameEl.style.cssText = `flex:1; color:rgba(255,255,255,.85); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
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
            statsEl.textContent = `${pctLabel}%`;

            // Wrap bar + % together so Completion header aligns with both
            const statsWrap = document.createElement('div');
            statsWrap.style.cssText = `display:flex; gap:8px; align-items:center; flex-shrink:0;`;
            statsWrap.appendChild(barWrap);
            statsWrap.appendChild(statsEl);

            const gotoBtn = document.createElement('button');
            gotoBtn.title = `Go to nearest incorrect ${color.name} pixel`;
            gotoBtn.style.cssText = `background:none; border:none; cursor:pointer; padding:0; font-size:13px; flex-shrink:0; line-height:1; width:${GOTO_W}px; text-align:center; opacity:0.55; transition:opacity .15s;`;
            gotoBtn.textContent = '⇨';
            gotoBtn.onclick = ev => {
                ev.stopPropagation();
                const ref    = this.apiManager?.lastClickCoords?.length === 4 ? this.apiManager.lastClickCoords : null;
                const coords = this.templateManager.findNearestIncorrectPixel(color.id, ref);
                if (coords) {
                    this.apiManager?.navigateToCoords(coords, 20);
                } else {
                    const toast = document.createElement('div');
                    toast.textContent = 'Nothing found — try ↻ to refresh stats';
                    toast.style.cssText = `position:fixed; background:rgba(0,0,0,.85); color:#fff; font-size:11px; padding:4px 8px; border-radius:4px; pointer-events:none; z-index:99999; white-space:nowrap; opacity:1; transition:opacity .4s;`;
                    const rect = gotoBtn.getBoundingClientRect();
                    toast.style.top  = `${rect.bottom + 4}px`;
                    toast.style.left = `${rect.left}px`;
                    document.body.appendChild(toast);
                    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2500);
                }
            };

            row.appendChild(toggleBtn);
            row.appendChild(swatch);
            row.appendChild(starEl);
            row.appendChild(nameEl);
            row.appendChild(statsWrap);
            row.appendChild(gotoBtn);

            rowData.push({ color, total, correct, pct, row });
        }

        // ── applyFilter: sort + search filter ─────────────────
        const applyFilter = () => {
            const term = searchInput.value.trim().toLowerCase();
            let rows = rowData.slice();

            if (sortState === 'name-asc')       rows.sort((a, b) => a.color.name.localeCompare(b.color.name));
            else if (sortState === 'name-desc')  rows.sort((a, b) => b.color.name.localeCompare(a.color.name));
            else if (sortState === 'pct-desc')   rows.sort((a, b) => b.pct - a.pct);
            else if (sortState === 'pct-asc')    rows.sort((a, b) => a.pct - b.pct);

            list.innerHTML = '';
            for (const item of rows) {
                item.row.style.display = (!term || item.color.name.toLowerCase().includes(term)) ? 'flex' : 'none';
                list.appendChild(item.row);
            }
            updateHeaderArrows();
        };

        applyFilter();
        content.appendChild(list);
        wrap.appendChild(content);
        document.body.appendChild(wrap);

        // ── Position: restores saved position or places below anchor ──
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
                this.settingsManager.persist();
            }
        });
        this.enableResizing(
            '#yawo-color-dropdown.yawo-window',
            (w, h) => { if (this.settingsManager?.settings) { this.settingsManager.settings.filterWindowSize = { w, h }; this.settingsManager.persist(); } },
            this.settingsManager?.settings?.filterWindowSize
        );
    }

}
