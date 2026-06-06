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
                const rid     = parseInt(row.dataset.colorId, 10);
                const swatch  = row.querySelector('.yawo-swatch-toggle');
                const shown   = !this.templateManager.hiddenColors.get(rid);
                if (swatch) {
                    swatch.dataset.state = shown ? 'shown' : 'hidden';
                    swatch.classList.toggle('yawo-swatch-toggle--hidden', !shown);
                    swatch.title = shown ? `Hide ${swatch.dataset.name} from the overlay` : `Show ${swatch.dataset.name} on the overlay`;
                }
                row.classList.toggle('yawo-filter-row--hidden', !shown);
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

        // ── Toolbar: search + filter mode ─────────────────────
        const searchWrap = document.createElement('div');
        searchWrap.className = 'yawo-filter-toolbar';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '🔍 Search colors…';
        searchInput.oninput = () => applyFilter();
        searchWrap.appendChild(searchInput);
        content.appendChild(searchWrap);

        // Filter mode selector — hovering/clicking the button opens a 3-mode menu.
        const filterModeConfig = {
            all:  { icon: '✓', label: 'All visible', bg: 'rgba(74,222,128,.18)',  border: 'rgba(74,222,128,.4)',  color: 'rgba(74,222,128,.9)' },
            none: { icon: '✗', label: 'All hidden',  bg: 'rgba(248,113,113,.18)', border: 'rgba(248,113,113,.4)', color: 'rgba(248,113,113,.9)' },
            solo: { icon: '◎', label: 'Selected',    bg: 'rgba(251,191,36,.18)',  border: 'rgba(251,191,36,.4)',  color: 'rgba(251,191,36,.9)' },
        };

        const filterWrap = document.createElement('div');
        filterWrap.style.cssText = `position:relative; flex-shrink:0;`;

        const filterBtn = document.createElement('button');
        filterBtn.className = 'yawo-filter-mode-btn';
        const refreshFilterBtn = () => {
            const cfg = filterModeConfig[filterMode];
            filterBtn.textContent       = `${cfg.icon} ${cfg.label} ▾`;
            filterBtn.style.background   = cfg.bg;
            filterBtn.style.borderColor  = cfg.border;
            filterBtn.style.color        = cfg.color;
            filterBtn.title              = `Filter: ${cfg.label}`;
        };

        const setFilterMode = mode => {
            filterMode = mode;
            if (mode === 'all') {
                stopSoloObs();
                this.templateManager._soloMode = false;
                this.templateManager.hiddenColors.clear();
            } else if (mode === 'none') {
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

        // ── Mode menu ─────────────────────────────────────────
        const menu = document.createElement('div');
        menu.style.cssText = `position:absolute; top:100%; left:0; margin-top:3px; background:rgba(20,20,20,.97); border:1px solid rgba(255,255,255,.15); border-radius:6px; padding:3px; display:none; flex-direction:column; gap:2px; z-index:100000; box-shadow:0 4px 14px rgba(0,0,0,.5);`;

        const menuItems = {};
        for (const mode of ['all', 'none', 'solo']) {
            const cfg  = filterModeConfig[mode];
            const item = document.createElement('button');
            item.style.cssText = `display:flex; align-items:center; gap:7px; padding:4px 10px 4px 7px; border:none; background:none; color:rgba(255,255,255,.85); font-size:11px; cursor:pointer; border-radius:4px; white-space:nowrap; text-align:left; width:100%; transition:background .12s;`;
            const ic = document.createElement('span');
            ic.textContent  = cfg.icon;
            ic.style.cssText = `color:${cfg.color}; width:12px; text-align:center; flex-shrink:0;`;
            const lbl = document.createElement('span');
            lbl.textContent = cfg.label;
            item.appendChild(ic);
            item.appendChild(lbl);
            item.onmouseenter = () => { if (!item.disabled) item.style.background = 'rgba(255,255,255,.1)'; };
            item.onmouseleave = () => { item.style.background = ''; };
            item.onclick = () => { if (item.disabled) return; setFilterMode(mode); hideMenu(); };
            menu.appendChild(item);
            menuItems[mode] = item;
        }

        // Greys out "Selected" and shows a tooltip when no palette color is selected.
        const refreshMenu = () => {
            const soloDisabled = getSelectedGameColor() === null;
            const solo = menuItems.solo;
            solo.disabled      = soloDisabled;
            solo.style.opacity = soloDisabled ? '0.4' : '1';
            solo.style.cursor  = soloDisabled ? 'not-allowed' : 'pointer';
            solo.title         = soloDisabled
                ? 'Select a color in the palette to enable this mode'
                : 'Show only the color selected in the palette';
            for (const m of ['all', 'none', 'solo']) {
                const active = m === filterMode;
                menuItems[m].style.fontWeight = active ? '700' : '400';
                menuItems[m].style.background = active ? 'rgba(255,255,255,.07)' : '';
            }
        };

        // ── Open/close (hover + click, with a small grace delay) ──
        let menuHideTimer = null;
        const showMenu = () => { clearTimeout(menuHideTimer); refreshMenu(); menu.style.display = 'flex'; };
        const hideMenu = () => { clearTimeout(menuHideTimer); menu.style.display = 'none'; };
        const scheduleHide = () => { menuHideTimer = setTimeout(hideMenu, 160); };

        filterBtn.onmouseenter = showMenu;
        filterBtn.onmouseleave = scheduleHide;
        menu.onmouseenter      = () => clearTimeout(menuHideTimer);
        menu.onmouseleave      = scheduleHide;
        filterBtn.onclick      = () => { if (menu.style.display === 'flex') hideMenu(); else showMenu(); };
        filterBtn.ontouchend   = ev => { ev.preventDefault(); filterBtn.click(); };

        refreshFilterBtn();
        filterWrap.appendChild(filterBtn);
        filterWrap.appendChild(menu);
        searchWrap.appendChild(filterWrap); // filter button lives on the search row

        // ── Sort control (lives on the search row, next to the filter) ──
        const sortConfig = {
            'id':        { icon: '⇅', label: 'Default' },
            'name-asc':  { icon: '↑', label: 'Name (A–Z)' },
            'name-desc': { icon: '↓', label: 'Name (Z–A)' },
            'pct-desc':  { icon: '↓', label: 'Completion (high→low)' },
            'pct-asc':   { icon: '↑', label: 'Completion (low→high)' },
        };

        const sortWrap = document.createElement('div');
        sortWrap.style.cssText = `position:relative; flex-shrink:0;`;

        const sortBtn = document.createElement('button');
        sortBtn.className = 'yawo-filter-mode-btn';
        const refreshSortBtn = () => {
            const cfg = sortConfig[sortState];
            // Default keeps a generic "Sort" label; an active sort shows what it is.
            sortBtn.textContent = sortState === 'id' ? '⇅ Sort ▾' : `${cfg.icon} ${cfg.label} ▾`;
            sortBtn.title       = `Sort: ${cfg.label}`;
        };

        const sortMenu = document.createElement('div');
        sortMenu.style.cssText = `position:absolute; top:100%; right:0; margin-top:3px; background:rgba(20,20,20,.97); border:1px solid rgba(255,255,255,.15); border-radius:6px; padding:3px; display:none; flex-direction:column; gap:2px; z-index:100000; box-shadow:0 4px 14px rgba(0,0,0,.5);`;

        const sortMenuItems = {};
        const refreshSortMenu = () => {
            for (const s of Object.keys(sortMenuItems)) {
                const active = s === sortState;
                sortMenuItems[s].style.fontWeight = active ? '700' : '400';
                sortMenuItems[s].style.background = active ? 'rgba(255,255,255,.07)' : '';
            }
        };

        for (const state of ['id', 'name-asc', 'name-desc', 'pct-desc', 'pct-asc']) {
            const cfg  = sortConfig[state];
            const item = document.createElement('button');
            item.style.cssText = `display:flex; align-items:center; gap:7px; padding:4px 10px 4px 7px; border:none; background:none; color:rgba(255,255,255,.85); font-size:11px; cursor:pointer; border-radius:4px; white-space:nowrap; text-align:left; width:100%; transition:background .12s;`;
            const ic = document.createElement('span');
            ic.textContent  = cfg.icon;
            ic.style.cssText = `width:12px; text-align:center; flex-shrink:0; opacity:.7;`;
            const lbl = document.createElement('span');
            lbl.textContent = cfg.label;
            item.appendChild(ic);
            item.appendChild(lbl);
            item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,.1)'; };
            item.onmouseleave = () => { item.style.background = state === sortState ? 'rgba(255,255,255,.07)' : ''; };
            item.onclick = () => { sortState = state; applyFilter(); hideSortMenu(); };
            sortMenu.appendChild(item);
            sortMenuItems[state] = item;
        }

        // ── Open/close (hover + click, with a small grace delay) ──
        let sortHideTimer = null;
        const showSortMenu = () => { clearTimeout(sortHideTimer); refreshSortMenu(); sortMenu.style.display = 'flex'; };
        const hideSortMenu = () => { clearTimeout(sortHideTimer); sortMenu.style.display = 'none'; };
        const scheduleSortHide = () => { sortHideTimer = setTimeout(hideSortMenu, 160); };

        sortBtn.onmouseenter = showSortMenu;
        sortBtn.onmouseleave = scheduleSortHide;
        sortMenu.onmouseenter = () => clearTimeout(sortHideTimer);
        sortMenu.onmouseleave = scheduleSortHide;
        sortBtn.onclick      = () => { if (sortMenu.style.display === 'flex') hideSortMenu(); else showSortMenu(); };
        sortBtn.ontouchend   = ev => { ev.preventDefault(); sortBtn.click(); };

        refreshSortBtn();
        sortWrap.appendChild(sortBtn);
        sortWrap.appendChild(sortMenu);
        searchWrap.insertBefore(sortWrap, filterWrap); // sort sits between search and filter

        // ── Liste scrollable ──────────────────────────────────
        const list = document.createElement('div');
        list.className = 'yawo-filter-list';

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
            row.className = 'yawo-filter-row';
            if (isHidden) row.classList.add('yawo-filter-row--hidden');

            // Swatch doubles as the show/hide toggle (grid col 1)
            const swatch = document.createElement('button');
            swatch.className = 'yawo-swatch-toggle';
            if (color.premium) swatch.classList.add('yawo-swatch--premium');
            if (isHidden) swatch.classList.add('yawo-swatch-toggle--hidden');
            // Force the box inline: wplace's base button CSS (min-width/padding) wins
            // over our class and would otherwise stretch the swatch into a rectangle.
            for (const [k, v] of [['width', '18px'], ['height', '18px'], ['min-width', '18px'], ['padding', '0'], ['box-sizing', 'border-box']])
                swatch.style.setProperty(k, v);
            swatch.style.background = `rgb(${r},${g},${b})`;
            swatch.dataset.state = isHidden ? 'hidden' : 'shown';
            swatch.dataset.name  = color.name;
            swatch.title = isHidden ? `Show ${color.name} on the overlay` : `Hide ${color.name} from the overlay`;
            swatch.onclick = ev => {
                ev.stopPropagation();
                if (swatch.dataset.state === 'shown') {
                    this.templateManager.hiddenColors.set(color.id, true);
                    this.templateManager.saveFilterState();
                    swatch.dataset.state = 'hidden';
                    swatch.classList.add('yawo-swatch-toggle--hidden');
                    swatch.title = `Show ${color.name} on the overlay`;
                    row.classList.add('yawo-filter-row--hidden');
                } else {
                    this.templateManager.hiddenColors.delete(color.id);
                    this.templateManager.saveFilterState();
                    swatch.dataset.state = 'shown';
                    swatch.classList.remove('yawo-swatch-toggle--hidden');
                    swatch.title = `Hide ${color.name} from the overlay`;
                    row.classList.remove('yawo-filter-row--hidden');
                }
            };

            // Name (grid col 2)
            const nameEl = document.createElement('span');
            nameEl.className = 'yawo-color-name';
            nameEl.textContent = color.name;

            const barColor = pct >= 80 ? 'var(--yawo-success)' : pct >= 40 ? 'var(--yawo-warning)' : 'var(--yawo-danger)';

            // Progress bar with counts centered inside (grid col 3)
            const barWrap = document.createElement('div');
            barWrap.className = 'yawo-bar';
            const bar = document.createElement('div');
            bar.className = 'yawo-bar-fill';
            bar.style.cssText = `background:${barColor}; width:${pct}%;`;
            const barLabel = document.createElement('span');
            barLabel.className = 'yawo-bar-label';
            barLabel.textContent = `${formatNumber(correct)} / ${formatNumber(total)}`;
            barWrap.appendChild(bar);
            barWrap.appendChild(barLabel);

            // Percentage (grid col 4)
            const statsEl = document.createElement('span');
            statsEl.className = 'yawo-bar-pct';
            statsEl.style.color = barColor;
            statsEl.textContent = `${pctLabel}%`;

            // Goto nearest incorrect pixel (grid col 5)
            const gotoBtn = document.createElement('button');
            gotoBtn.className = 'yawo-goto-btn';
            gotoBtn.title = `Go to nearest incorrect ${color.name} pixel`;
            gotoBtn.textContent = '🎯';
            // Neutralize wplace's base button sizing (min-width/padding) and size the
            // emoji via font-size — all forced inline so wplace's base CSS can't win.
            for (const [k, v] of [['min-width', '0'], ['width', '22px'], ['height', '22px'], ['padding', '0'], ['box-sizing', 'border-box'], ['font-size', '17px'], ['line-height', '1']])
                gotoBtn.style.setProperty(k, v);
            gotoBtn.onclick = ev => {
                ev.stopPropagation();
                const ref    = this.apiManager?.lastClickCoords?.length === 4 ? this.apiManager.lastClickCoords : null;
                const coords = this.templateManager.findNearestIncorrectPixel(color.id, ref);
                if (coords) {
                    this.apiManager?.navigateToCoords(
                        coords,
                        this.settingsManager?.settings?.gotoZoom ?? 20,
                        true,
                        this.settingsManager?.settings?.gotoSpeed ?? 1.2,
                    );
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

            row.appendChild(swatch);
            row.appendChild(nameEl);
            row.appendChild(barWrap);
            row.appendChild(statsEl);
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
                // Empty string (not 'flex') so the row falls back to its CSS `display: grid`
                // — an inline 'flex' here would override the grid and break column alignment.
                item.row.style.display = (!term || item.color.name.toLowerCase().includes(term)) ? '' : 'none';
                list.appendChild(item.row);
            }
            refreshSortBtn();
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
