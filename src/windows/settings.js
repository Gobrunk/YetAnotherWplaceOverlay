import { Overlay } from '../overlay.js';
import { icon, bindRange } from './common.js';

export class WindowSettings extends Overlay {
    constructor(name, version) {
        super(name, version);
        this.windowId    = 'yawo-window-settings';
        this.mountTarget = document.body;
    }

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            document.querySelector(`#${this.windowId}`).remove();
            return;
        }
        this.addDiv({ id: this.windowId, class: 'yawo-window', style: 'top: 10px; left: 10px;' })
            .addWindowHeader({
                title: 'Settings',
                onClose: () => document.querySelector(`#${this.windowId}`)?.remove(),
            })
            .addDiv({ class: 'yawo-content' })
                .addDiv({ class: 'yawo-settings-sub' })
                    .addSpan({ class: 'yawo-settings-sub-icon', innerHTML: icon('info', 13) }).up()
                    .addSpan({ textContent: 'Changes save automatically — give it ~5 s.' }).up()
                .up()
                .addDiv({ class: 'yawo-col yawo-sections' }, () => {
                    this.buildTemplateSection();
                    this.buildOverlaySection();
                    this.buildNavigationSection();
                    this.buildWindowsSection();
                }).up()
            .up()
            .addWindowFooter({
                version: this.version,
                buttons: [{ html: `<span class="yawo-footer-note--ok">${icon('check', 12)} Saved</span>`, title: 'Settings save automatically' }],
            })
        .mount(this.mountTarget);
        this.applyWindowPosition(document.querySelector(`#${this.windowId}`), this.settings?.settingsWindowPosition);

        // Restore the persisted compact layout on mount.
        if (this.settings?.settingsCompact) {
            const win = document.querySelector(`#${this.windowId}`);
            this.#applyCompact(win, win?.querySelector('.yawo-compact-btn'), true);
        }

        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar, #${this.windowId} .yawo-footer`, (x, y) => {
            if (this.settings) { this.settings.settingsWindowPosition = { x, y }; this.persist?.(); }
        });
        this.enableResizing(
            `#${this.windowId}.yawo-window`,
            (w, h) => { if (this.settings) { this.settings.settingsWindowSize = { w, h }; this.persist?.(); } },
            this.settings?.settingsWindowSize
        );
    }

    // Toggle the compact layout on the settings window, persisting the choice.
    // Like the filter/overlays windows (and unlike main), we keep the current
    // height: the sections scroll, so clearing it would let them expand the window.
    toggleCompact(btn) {
        const win = document.querySelector(`#${this.windowId}`);
        if (!win) return;
        const next = !win.classList.contains('yawo-compact');
        this.#applyCompact(win, btn, next);
        if (this.settings) { this.settings.settingsCompact = next; this.persist?.(); }
        this.setStatus(next ? 'Compact view enabled!' : 'Compact view disabled!');
    }

    // Sync the window's compact class and the chrome button's icon/state.
    #applyCompact(win, btn, compact) {
        if (!win) return;
        win.classList.toggle('yawo-compact', compact);
        if (btn) {
            btn.dataset.compactStatus = compact ? 'compact' : 'normal';
            btn.innerHTML = icon(compact ? 'maximize2' : 'minimize2');
            btn.title = compact ? 'Normal view' : 'Compact view';
        }
    }

    // ── Section: a titled card with an icon badge ─────────────
    #beginSection(title, iconName, badgeClass) {
        return this.addDiv({ class: 'yawo-section' })
            .addDiv({ class: 'yawo-section-head' })
                .addSpan({ class: `yawo-section-badge ${badgeClass}`, innerHTML: icon(iconName, 16) }).up()
                .addHeading(2, { textContent: title, class: 'yawo-section-title' }).up()
            .up();
    }

    // ── A label + value header followed by a green-fill slider ──
    #addSlider(section, { label, value, min, max, step, parse, fmt, onInput }) {
        let valueRef = null;
        section
            .addDiv({ class: 'yawo-slider-row' })
                .addSmall({ textContent: label, class: 'yawo-slider-label' }).up()
                .addSpan({ textContent: fmt(value), class: 'yawo-slider-value yawo-mono' }, (ov, el) => { valueRef = el; }).up()
            .up()
            .addInput({ type: 'range', min, max, step, value: value.toString() }, (ov, input) => {
                bindRange(input);
                input.oninput = () => {
                    const val = parse(input.value, 10);
                    onInput(val);
                    if (valueRef) valueRef.textContent = fmt(val);
                };
            }).up();
    }

    buildTemplateSection() {
        const getMode = () => {
            if (this.settings?.flags?.includes('hl-noSkip')) return 'none';
            if (this.settings?.flags?.includes('hl-agSkip')) return 'aggressive';
            return 'skip';
        };

        const modes = [
            { id: 'skip',       label: 'Skip empty',     desc: 'Tiles with no visible pixels are ignored. Recommended.' },
            { id: 'aggressive', label: 'Aggressive',     desc: 'Quick rougher scan — may miss tiles with only a few pixels.' },
            { id: 'none',       label: 'Include all',    desc: 'Every tile is imported, even fully transparent ones.' },
        ];

        const btnRefs = {};
        let descRef   = null;

        const refresh = () => {
            const current = getMode();
            for (const { id } of modes) {
                btnRefs[id]?.classList.toggle('yawo-seg-btn--active', current === id);
            }
            if (descRef) descRef.textContent = modes.find(m => m.id === current)?.desc ?? '';
        };

        const setMode = (id) => {
            if (id === 'skip')       { this.toggleFlag('hl-noSkip', false); this.toggleFlag('hl-agSkip', false); }
            if (id === 'aggressive') { this.toggleFlag('hl-noSkip', false); this.toggleFlag('hl-agSkip', true);  }
            if (id === 'none')       { this.toggleFlag('hl-noSkip', true);  this.toggleFlag('hl-agSkip', false); }
            refresh();
        };

        this.#beginSection('Template', 'grid', 'yawo-badge--green')
            .addSmall({ textContent: 'Transparent tiles', class: 'yawo-form-label' }).up()
            .addDiv({ class: 'yawo-seg' }, (overlay) => {
                for (const { id, label } of modes) {
                    overlay.addButton({ textContent: label, class: 'yawo-seg-btn' }, (ov, btn) => {
                        btnRefs[id] = btn;
                        btn.onclick = () => setMode(id);
                    }).up();
                }
            }).up()
            .addSmall({ class: 'yawo-section-desc' }, (ov, el) => { descRef = el; }).up()
        .up();

        refresh();
    }

    buildOverlaySection() {
        const opacity = this.settings?.overlayOpacity ?? 1.0;

        const section = this.#beginSection('Overlay', 'eye', 'yawo-badge--blue');
        this.#addSlider(section, {
            label: 'Opacity', value: opacity, min: '0.1', max: '1', step: '0.05',
            parse: parseFloat, fmt: v => Math.round(v * 100) + '%',
            onInput: v => { this.settings.overlayOpacity = v; },
        });
        section.up();
    }

    buildNavigationSection() {
        // Each slider drives one navigation setting. Zoom sliders use integer steps,
        // speed sliders map onto flyTo's `speed` option (higher = faster, default 1.2).
        const groups = [
            {
                title: 'Nearest incorrect pixel',
                sliders: [
                    { key: 'gotoZoom',  label: 'Zoom level',      min: '12',  max: '20', step: '1',   def: 20,  parse: parseInt,   fmt: v => v.toString() },
                    { key: 'gotoSpeed', label: 'Animation speed', min: '0.4', max: '3',  step: '0.1', def: 1.2, parse: parseFloat, fmt: v => v.toFixed(1) + '×' },
                ],
            },
            {
                title: 'Overlay anchor pixel',
                sliders: [
                    { key: 'overlayZoom',  label: 'Zoom level',      min: '12',  max: '20', step: '1',   def: 12,  parse: parseInt,   fmt: v => v.toString() },
                    { key: 'overlaySpeed', label: 'Animation speed', min: '0.4', max: '3',  step: '0.1', def: 1.2, parse: parseFloat, fmt: v => v.toFixed(1) + '×' },
                ],
            },
        ];

        const section = this.#beginSection('Navigation', 'compass', 'yawo-badge--amber');
        for (const group of groups) {
            section.addSmall({ textContent: group.title, class: 'yawo-form-label' }).up();
            for (const s of group.sliders) {
                this.#addSlider(section, {
                    label: s.label, value: this.settings?.[s.key] ?? s.def,
                    min: s.min, max: s.max, step: s.step, parse: s.parse, fmt: s.fmt,
                    onInput: v => { this.settings[s.key] = v; },
                });
            }
        }
        section.up();
    }

    buildWindowsSection() {
        this.#beginSection('Windows', 'grid', 'yawo-badge--blue')
            .addSmall({ textContent: 'Bring every window back to its default spot.', class: 'yawo-section-desc' }).up()
            .addButton({ class: 'yawo-reset-btn', innerHTML: `${icon('compass', 14)} Reset window positions` }, (ov, btn) => {
                btn.title = 'Reset all window positions';
                btn.onclick = () => this.resetWindowPositions();
            }).up()
        .up();
    }

    // Forget every saved window position and snap any open window back to its
    // mount-time default — an escape hatch if a window ends up out of reach.
    resetWindowPositions() {
        for (const k of ['windowPosition', 'filterWindowPosition',
                         'templateWindowPosition', 'settingsWindowPosition']) {
            delete this.settings?.[k];
        }
        this.persist?.();
        const defaults = {
            'yawo-window-main':            { top: '10px', left: 'unset', right: '75px' },
            'yawo-color-dropdown':         { top: '10px', left: '10px',  right: ''     },
            'yawo-window-template-select': { top: '10px', left: '10px',  right: ''     },
            'yawo-window-settings':        { top: '10px', left: '10px',  right: ''     },
        };
        for (const [id, pos] of Object.entries(defaults)) {
            const el = document.querySelector('#' + id);
            if (!el) continue;
            el.style.transform = '';
            Object.assign(el.style, pos);
        }
    }
}
