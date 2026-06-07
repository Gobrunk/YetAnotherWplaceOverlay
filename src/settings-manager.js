import { WindowSettings } from './window-settings.js';

export class SettingsManager extends WindowSettings {
    constructor(name, version, settings) {
        super(name, version);
        this.settings           = settings;
        this.settings.flags          ??= [];
        this.settings.overlayOpacity ??= 1.0;
        this.settings.gotoZoom       ??= 20;
        this.settings.overlayZoom    ??= 12;
        this.settings.gotoSpeed      ??= 1.2;
        this.settings.overlaySpeed   ??= 1.2;
        this.savedSettings      = structuredClone(this.settings);
        this.storageKey         = 'yawoUserSettings';
        this.saveIntervalMs     = 5000;
        this.lastSaveTimestamp  = 0;
        setInterval(this.#autoSave.bind(this), this.saveIntervalMs);
    }

    toggleFlag(flag, forceValue = undefined) {
        const idx = this.settings?.flags?.indexOf(flag) ?? -1;
        if (idx !== -1 && forceValue !== true)        this.settings?.flags?.splice(idx, 1);
        else if (idx === -1 && forceValue !== false)  this.settings?.flags?.push(flag);
    }

    // Build a settings section as a card: tinted icon badge + uppercase title in
    // the header, controls supplied by `bodyFn` go in the card body.
    buildCard(icon, badgeClass, title, bodyFn) {
        this.addDiv({ class: 'yawo-settings-card' })
            .addDiv({ class: 'yawo-card-header' })
                .addSpan({ textContent: icon, class: `yawo-card-badge ${badgeClass}` }).up()
                .addHeading(2, { textContent: title, class: 'yawo-card-title' }).up()
            .up()
            .addDiv({ class: 'yawo-card-body' }, (body) => bodyFn(body))
        .up();
    }

    buildTemplateSection() {
        const getMode = () => {
            if (this.settings?.flags?.includes('hl-noSkip')) return 'none';
            if (this.settings?.flags?.includes('hl-agSkip')) return 'aggressive';
            return 'skip';
        };

        const modes = [
            { id: 'skip',       label: 'Skip empty',      desc: 'Tiles with no visible pixels are ignored. Recommended.' },
            { id: 'aggressive', label: 'Aggressive skip',  desc: 'Quick rougher scan — may miss tiles with only a few pixels.' },
            { id: 'none',       label: 'Include all',      desc: 'Every tile is imported, even fully transparent ones.' },
        ];

        const btnRefs = {};
        let descRef   = null;

        const refresh = () => {
            const current = getMode();
            for (const { id } of modes) {
                const btn = btnRefs[id];
                if (!btn) continue;
                btn.classList.toggle('yawo-seg-btn--active', current === id);
            }
            if (descRef) descRef.textContent = modes.find(m => m.id === current)?.desc ?? '';
        };

        const setMode = (id) => {
            if (id === 'skip')       { this.toggleFlag('hl-noSkip', false); this.toggleFlag('hl-agSkip', false); }
            if (id === 'aggressive') { this.toggleFlag('hl-noSkip', false); this.toggleFlag('hl-agSkip', true);  }
            if (id === 'none')       { this.toggleFlag('hl-noSkip', true);  this.toggleFlag('hl-agSkip', false); }
            refresh();
        };

        this.buildCard('🧩', 'yawo-badge-template', 'Template', (body) => {
            body
                .addSmall({ textContent: 'Transparent tiles', class: 'yawo-form-label' }).up()
                .addDiv({ class: 'yawo-segmented' }, (seg) => {
                    for (const { id, label } of modes) {
                        seg.addButton({ textContent: label, class: 'yawo-seg-btn' }, (ov, btn) => {
                            btnRefs[id] = btn;
                            btn.onclick = () => setMode(id);
                        }).up();
                    }
                }).up()
                .addSmall({}, (ov, el) => { descRef = el; }).up();
        });

        refresh();
    }

    buildOverlaySection() {
        let valueRef  = null;
        const opacity = this.settings?.overlayOpacity ?? 1.0;

        this.buildCard('👁', 'yawo-badge-overlay', 'Overlay', (body) => {
            body
                .addSmall({ textContent: 'Opacity', class: 'yawo-form-label' }).up()
                .addDiv({ class: 'yawo-row' })
                    .addInput({ type: 'range', min: '0.1', max: '1', step: '0.05',
                                value: opacity.toString(), style: 'flex:1;' }, (ov, input) => {
                        input.oninput = () => {
                            const val = parseFloat(input.value);
                            this.settings.overlayOpacity = val;
                            if (valueRef) valueRef.textContent = Math.round(val * 100) + '%';
                        };
                    }).up()
                    .addSmall({ textContent: Math.round(opacity * 100) + '%',
                                style: 'min-width:3ch; text-align:right;' }, (ov, el) => {
                        valueRef = el;
                    }).up()
                .up();
        });
    }

    buildNavigationSection() {
        // Each slider drives one navigation setting. Zoom sliders use integer steps,
        // speed sliders map onto flyTo's `speed` option (higher = faster, default 1.2).
        const sliders = [
            { key: 'gotoZoom',     label: '"Go to nearest incorrect pixel" zoom',  min: '12',  max: '20', step: '1',   def: 20,  parse: parseInt,   fmt: v => v.toString() },
            { key: 'gotoSpeed',    label: '"Go to nearest incorrect pixel" speed', min: '0.4', max: '3',  step: '0.1', def: 1.2, parse: parseFloat, fmt: v => v.toFixed(1) },
            { key: 'overlayZoom',  label: '"Go to overlay anchor pixel" zoom',     min: '12',  max: '20', step: '1',   def: 12,  parse: parseInt,   fmt: v => v.toString() },
            { key: 'overlaySpeed', label: '"Go to overlay anchor pixel" speed',    min: '0.4', max: '3',  step: '0.1', def: 1.2, parse: parseFloat, fmt: v => v.toFixed(1) },
        ];

        this.buildCard('🧭', 'yawo-badge-nav', 'Navigation', (body) => {
            for (const s of sliders) {
                const value = this.settings?.[s.key] ?? s.def;
                let valueRef = null;
                body
                    .addSmall({ textContent: s.label, class: 'yawo-form-label' }).up()
                    .addDiv({ class: 'yawo-row' })
                        .addInput({ type: 'range', min: s.min, max: s.max, step: s.step,
                                    value: value.toString(), style: 'flex:1;' }, (ov, input) => {
                            input.oninput = () => {
                                const val = s.parse(input.value, 10);
                                this.settings[s.key] = val;
                                if (valueRef) valueRef.textContent = s.fmt(val);
                            };
                        }).up()
                        .addSmall({ textContent: s.fmt(value),
                                    style: 'min-width:3ch; text-align:right;' }, (ov, el) => {
                            valueRef = el;
                        }).up()
                    .up();
            }
        });
    }

    // ── Private methods ───────────────────────────────────────

    async persist() {
        const serialized = JSON.stringify(this.settings);
        if (serialized === JSON.stringify(this.savedSettings)) return;
        await GM.setValue(this.storageKey, serialized);
        this.savedSettings     = structuredClone(this.settings);
        this.lastSaveTimestamp = Date.now();
    }

    async #autoSave() {
        if (Date.now() - this.lastSaveTimestamp > this.saveIntervalMs) this.persist();
    }

}
