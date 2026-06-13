import { Overlay } from '../overlay.js';
import { buildTitlebar, buildFooter, icon } from './common.js';
import { formatNumber, formatPct } from '../utils.js';

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
        let sortState = this._sortState ?? 'id'; // 'id' | 'name-asc' | 'name-desc' | 'pct-desc' | 'pct-asc'

        const updateVisibleCount = () => {
            const note = wrap?.querySelector('.yawo-footer-note');
            if (!note) return;
            const visible = rowData.filter(d => !this.templateManager.hiddenColors.get(d.color.id)).length;
            note.textContent = `${visible} visible`;
        };

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
            updateVisibleCount();
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

        // ── Titlebar ──────────────────────────────────────────
        const shownCount = sortedPal.filter(p => p.id > 0 && (ieMap.get(p.id) ?? 0) > 0).length;
        const titlebar = buildTitlebar({
            title: 'Colors',
            badge: `${shownCount}`,
            minimizeLabel: 'Minimize window "Color Filter"',
            onMinimize: btn => this.toggleMinimize(btn),
            onCompact: btn => this.toggleCompact(btn),
            buttons: [
                { icon: 'refresh', title: 'Refresh stats', onClick: () => { wrap.remove(); this.templateManager.refreshCorrectStats().then(() => this.toggle()); } },
            ],
            onClose: () => { stopSoloObs(); wrap.remove(); },
            closeLabel: 'Close window "Color Filter"',
        });
        wrap.appendChild(titlebar);

        // ── Content ───────────────────────────────────────────
        const content = document.createElement('div');
        content.className = 'yawo-content yawo-filter-content';

        // ── Toolbar: search + sort + filter mode ──────────────
        const searchWrap = document.createElement('div');
        searchWrap.className = 'yawo-filter-toolbar';

        const searchBox = document.createElement('div');
        searchBox.className = 'yawo-search-box';
        searchBox.innerHTML = icon('search', 14);
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search colors…';
        searchInput.oninput = () => applyFilter();
        searchBox.appendChild(searchInput);
        searchWrap.appendChild(searchBox);
        content.appendChild(searchWrap);

        // Filter mode selector — hovering/clicking the button opens a 3-mode menu.
        const filterModeConfig = {
            all:  { icon: '✓', label: 'All visible', color: 'var(--yawo-success)' },
            none: { icon: '✗', label: 'All hidden',  color: 'var(--yawo-danger)' },
            solo: { icon: '◎', label: 'Selected',    color: 'var(--yawo-warning)' },
        };

        const filterWrap = document.createElement('div');
        filterWrap.className = 'yawo-menu-wrap';

        const filterBtn = document.createElement('button');
        filterBtn.className = 'yawo-filter-mode-btn';
        const refreshFilterBtn = () => {
            const cfg = filterModeConfig[filterMode];
            filterBtn.innerHTML = `<span class="yawo-mode-dot" style="background:${cfg.color}"></span><span>${cfg.label}</span>`;
            filterBtn.title     = `Filter: ${cfg.label}`;
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
        menu.className = 'yawo-menu';

        const menuItems = {};
        for (const mode of ['all', 'none', 'solo']) {
            const cfg  = filterModeConfig[mode];
            const item = document.createElement('button');
            item.className = 'yawo-menu-item';
            const ic = document.createElement('span');
            ic.className   = 'yawo-menu-icon';
            ic.textContent = cfg.icon;
            ic.style.color = cfg.color;
            const lbl = document.createElement('span');
            lbl.textContent = cfg.label;
            item.appendChild(ic);
            item.appendChild(lbl);
            item.onclick = () => { if (item.disabled) return; setFilterMode(mode); hideMenu(); };
            menu.appendChild(item);
            menuItems[mode] = item;
        }

        // Greys out "Selected" and shows a tooltip when no palette color is selected.
        const refreshMenu = () => {
            const soloDisabled = getSelectedGameColor() === null;
            const solo = menuItems.solo;
            solo.disabled      = soloDisabled;
            solo.classList.toggle('yawo-menu-item--disabled', soloDisabled);
            solo.title         = soloDisabled
                ? 'Select a color in the palette to enable this mode'
                : 'Show only the color selected in the palette';
            for (const m of ['all', 'none', 'solo'])
                menuItems[m].classList.toggle('yawo-menu-item--active', m === filterMode);
        };

        // ── Open/close (hover + click, with a small grace delay) ──
        let menuHideTimer = null;
        const showMenu = () => { clearTimeout(menuHideTimer); refreshMenu(); menu.classList.add('yawo-menu--open'); };
        const hideMenu = () => { clearTimeout(menuHideTimer); menu.classList.remove('yawo-menu--open'); };
        const scheduleHide = () => { menuHideTimer = setTimeout(hideMenu, 160); };

        filterBtn.onmouseenter = showMenu;
        filterBtn.onmouseleave = scheduleHide;
        menu.onmouseenter      = () => clearTimeout(menuHideTimer);
        menu.onmouseleave      = scheduleHide;
        filterBtn.onclick      = () => { if (menu.classList.contains('yawo-menu--open')) hideMenu(); else showMenu(); };
        filterBtn.ontouchend   = ev => { ev.preventDefault(); filterBtn.click(); };

        refreshFilterBtn();
        filterWrap.appendChild(filterBtn);
        filterWrap.appendChild(menu);

        // ── Sort control ──────────────────────────────────────
        const sortConfig = {
            'id':        { icon: '⇅', label: 'Default' },
            'name-asc':  { icon: '↑', label: 'Name (A–Z)' },
            'name-desc': { icon: '↓', label: 'Name (Z–A)' },
            'pct-desc':  { icon: '↓', label: 'Completion (high→low)' },
            'pct-asc':   { icon: '↑', label: 'Completion (low→high)' },
        };

        const sortWrap = document.createElement('div');
        sortWrap.className = 'yawo-menu-wrap';

        const sortBtn = document.createElement('button');
        sortBtn.className = 'yawo-filter-mode-btn';
        const refreshSortBtn = () => {
            const cfg = sortConfig[sortState];
            sortBtn.innerHTML = sortState === 'id'
                ? `${icon('sort', 13)}<span>Sort</span>`
                : `${icon('sort', 13)}<span>${cfg.label}</span>`;
            sortBtn.title = `Sort: ${cfg.label}`;
        };

        const sortMenu = document.createElement('div');
        sortMenu.className = 'yawo-menu yawo-menu--right';

        const sortMenuItems = {};
        const refreshSortMenu = () => {
            for (const s of Object.keys(sortMenuItems))
                sortMenuItems[s].classList.toggle('yawo-menu-item--active', s === sortState);
        };

        for (const state of ['id', 'name-asc', 'name-desc', 'pct-desc', 'pct-asc']) {
            const cfg  = sortConfig[state];
            const item = document.createElement('button');
            item.className = 'yawo-menu-item';
            const ic = document.createElement('span');
            ic.className   = 'yawo-menu-icon';
            ic.textContent = cfg.icon;
            const lbl = document.createElement('span');
            lbl.textContent = cfg.label;
            item.appendChild(ic);
            item.appendChild(lbl);
            item.onclick = () => { sortState = this._sortState = state; applyFilter(); hideSortMenu(); };
            sortMenu.appendChild(item);
            sortMenuItems[state] = item;
        }

        // ── Open/close (hover + click, with a small grace delay) ──
        let sortHideTimer = null;
        const showSortMenu = () => { clearTimeout(sortHideTimer); refreshSortMenu(); sortMenu.classList.add('yawo-menu--open'); };
        const hideSortMenu = () => { clearTimeout(sortHideTimer); sortMenu.classList.remove('yawo-menu--open'); };
        const scheduleSortHide = () => { sortHideTimer = setTimeout(hideSortMenu, 160); };

        sortBtn.onmouseenter = showSortMenu;
        sortBtn.onmouseleave = scheduleSortHide;
        sortMenu.onmouseenter = () => clearTimeout(sortHideTimer);
        sortMenu.onmouseleave = scheduleSortHide;
        sortBtn.onclick      = () => { if (sortMenu.classList.contains('yawo-menu--open')) hideSortMenu(); else showSortMenu(); };
        sortBtn.ontouchend   = ev => { ev.preventDefault(); sortBtn.click(); };

        refreshSortBtn();
        sortWrap.appendChild(sortBtn);
        sortWrap.appendChild(sortMenu);

        // Toolbar order: search · sort · filter mode
        searchWrap.appendChild(sortWrap);
        searchWrap.appendChild(filterWrap);

        // ── Scrollable list ───────────────────────────────────
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
            const complete = total > 0 && correct >= total;
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
            if (complete) swatch.classList.add('yawo-swatch-toggle--done');
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
                updateVisibleCount();
            };

            // Name + count (grid col 2). The count is hidden in normal mode (the count
            // lives inside the bar there); in compact mode the block flattens
            // (display:contents) so name and count become their own grid columns.
            const nameBlock = document.createElement('div');
            nameBlock.className = 'yawo-name-block';
            const nameEl = document.createElement('span');
            nameEl.className = 'yawo-color-name';
            nameEl.textContent = color.name;
            const countEl = document.createElement('span');
            countEl.className = 'yawo-color-count yawo-mono';
            countEl.textContent = `${formatNumber(correct)} / ${formatNumber(total)}`;
            nameBlock.appendChild(nameEl);
            nameBlock.appendChild(countEl);

            const barColor = pct >= 80 ? 'var(--yawo-success)' : pct >= 40 ? 'var(--yawo-progress-warn)' : 'var(--yawo-danger)';

            // Progress bar with counts centered inside (grid col 3)
            const barWrap = document.createElement('div');
            barWrap.className = 'yawo-bar';
            const bar = document.createElement('div');
            bar.className = 'yawo-bar-fill';
            bar.style.width = `${pct}%`;
            if (complete) bar.classList.add('yawo-bar-fill--done'); // gold gradient via CSS
            else bar.style.background = barColor;
            const barLabel = document.createElement('span');
            barLabel.className = 'yawo-bar-label yawo-mono';
            barLabel.textContent = `${formatNumber(correct)} / ${formatNumber(total)}`;
            barWrap.appendChild(bar);
            barWrap.appendChild(barLabel);

            // Percentage (grid col 4); gold text when the color is fully placed
            const statsEl = document.createElement('span');
            statsEl.className = 'yawo-bar-pct yawo-mono';
            if (complete) {
                statsEl.classList.add('yawo-bar-pct--done'); // gold text via CSS
            } else {
                statsEl.style.color = barColor;
            }
            const pctText = document.createElement('span');
            pctText.textContent = `${pctLabel}%`;
            statsEl.appendChild(pctText);

            // Goto nearest incorrect pixel (grid col 5). In compact mode the button
            // stays in the row but is revealed only on row hover (see filters.css).
            const gotoBtn = document.createElement('button');
            gotoBtn.className = 'yawo-goto-btn';
            gotoBtn.title = `Go to nearest incorrect ${color.name} pixel`;
            gotoBtn.innerHTML = icon('crosshair', 16);
            // Neutralize wplace's base button sizing (min-width/padding), all forced inline.
            for (const [k, v] of [['min-width', '0'], ['width', '24px'], ['height', '24px'], ['padding', '0'], ['box-sizing', 'border-box']])
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
                    toast.style.cssText = `position:fixed; background:rgba(0,0,0,.85); color:#fff; font-size:11px; padding:4px 8px; border-radius:6px; pointer-events:none; z-index:99999; white-space:nowrap; opacity:1; transition:opacity .4s;`;
                    const rect = gotoBtn.getBoundingClientRect();
                    toast.style.top  = `${rect.bottom + 4}px`;
                    toast.style.left = `${rect.left}px`;
                    document.body.appendChild(toast);
                    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2500);
                }
            };

            row.appendChild(swatch);
            row.appendChild(nameBlock);
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
        wrap.appendChild(buildFooter({ version: this.version, note: '' }));
        document.body.appendChild(wrap);
        updateVisibleCount();

        // Restore the persisted compact layout on mount.
        if (this.settingsManager?.settings?.filterCompact) {
            this.#applyCompact(wrap, wrap.querySelector('.yawo-compact-btn'), true);
        }

        // ── Position: restores saved position or places below anchor ──
        if (!this.applyWindowPosition(wrap, this.settingsManager?.settings?.filterWindowPosition)) {
            const rect = anchor.getBoundingClientRect();
            wrap.style.top  = (rect.bottom + 4) + 'px';
            wrap.style.left = rect.left + 'px';
        }

        // ── Dragging ──────────────────────────────────────────
        this.enableDragging('#yawo-color-dropdown.yawo-window', '#yawo-color-dropdown .yawo-titlebar, #yawo-color-dropdown .yawo-footer', (x, y) => {
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

    // Toggle the compact layout on the filter window, persisting the choice.
    toggleCompact(btn) {
        const win = document.querySelector('#yawo-color-dropdown');
        if (!win) return;
        const next = !win.classList.contains('yawo-compact');
        this.#applyCompact(win, btn, next);
        if (this.settingsManager?.settings) {
            this.settingsManager.settings.filterCompact = next;
            this.settingsManager.persist();
        }
        this.setStatus(next ? 'Compact view enabled!' : 'Compact view disabled!');
    }

    // Sync the window's compact class and the chrome button's icon/state.
    // Unlike the main window, we keep the current height: the color list scrolls
    // (overflow:auto), so clearing it would let the list expand to every color and
    // blow the window up to full height.
    #applyCompact(win, btn, compact) {
        if (!win) return;
        win.classList.toggle('yawo-compact', compact);
        if (btn) {
            btn.dataset.compactStatus = compact ? 'compact' : 'normal';
            btn.innerHTML = icon(compact ? 'maximize2' : 'minimize2');
            btn.title = compact ? 'Normal view' : 'Compact view';
        }
    }

}
