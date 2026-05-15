import { WindowSettings } from './window-settings.js';
import { sleep } from './utils.js';

export class SettingsManager extends WindowSettings {
    constructor(name, version, settings) {
        super(name, version);
        this.settings           = settings;
        this.settings.flags     ??= [];
        this.savedSettings      = structuredClone(this.settings);
        this.storageKey         = 'bmUserSettings';
        this.saveIntervalMs     = 5000;
        this.lastSaveTimestamp  = 0;
        setInterval(this.#autoSave.bind(this), this.saveIntervalMs);
    }

    toggleFlag(flag, forceValue = undefined) {
        const idx = this.settings?.flags?.indexOf(flag) ?? -1;
        if (idx !== -1 && forceValue !== true)        this.settings?.flags?.splice(idx, 1);
        else if (idx === -1 && forceValue !== false)  this.settings?.flags?.push(flag);
    }

    buildPixelHighlightSection() {
        const svgGrid = '<svg viewBox="0 0 3 3"><path d="M0,0H3V3H0ZM0,1H3M0,2H3M1,0V3M2,0V3" fill="#fff"/><path d="M1,1H2V2H1Z" fill="#2f4f4f"/></svg>';
        const svgCross = '<svg viewBox="0 0 3 3"><path d="M0,0H3V3H0Z" fill="#fff"/><path d="M1,0H2V1H3V2H2V3H1V2H0V1H1Z" fill="brown"/><path d="M1,1H2V2H1Z" fill="#2f4f4f"/></svg>';
        const highlight = this.settings?.highlight ?? [[1,0,1],[2,0,0],[1,-1,0],[1,1,0],[1,0,-1]];

        this.addDiv({ class: 'bm-col' })
            .addHeading(2, { textContent: 'Pixel Highlight' }).up()
            .addHr().up()
            .addDiv({ class: 'bm-col', style: 'margin-left: 1.5ch;' })
                .addCheckbox({ textContent: 'Highlight transparent pixels' }, (ov, label, input) => {
                    input.checked  = !this.settings?.flags?.includes('hl-noTrans');
                    input.onchange = e => this.toggleFlag('hl-noTrans', !e.target.checked);
                }).up()
                .addParagraph({ id: 'bm-preset-label', textContent: 'Choose a preset:', style: 'font-weight: 700;' }).up()
                .addDiv({ class: 'bm-row', role: 'group', 'aria-labelledby': 'bm-preset-label' })
                    .addDiv({ class: 'bm-preset-cell' })
                        .addSpan({ textContent: 'None' }).up()
                        .addButton({ innerHTML: svgGrid, 'aria-label': 'Preset "None"' }, (ov, btn) => {
                            btn.onclick = () => this.#applyHighlightPreset('None');
                        }).up()
                    .up()
                    .addDiv({ class: 'bm-preset-cell' })
                        .addSpan({ textContent: 'Cross' }).up()
                        .addButton({ innerHTML: svgCross, 'aria-label': 'Preset "Cross Shape"' }, (ov, btn) => {
                            btn.onclick = () => this.#applyHighlightPreset('Cross');
                        }).up()
                    .up()
                    .addDiv({ class: 'bm-preset-cell' })
                        .addSpan({ textContent: 'X' }).up()
                        .addButton({ innerHTML: svgCross.replace('d="M1,0H2V1H3V2H2V3H1V2H0V1H1Z"', 'd="M0,0V1H3V0H2V3H3V2H0V3H1V0Z"'), 'aria-label': 'Preset "X Shape"' }, (ov, btn) => {
                            btn.onclick = () => this.#applyHighlightPreset('X');
                        }).up()
                    .up()
                    .addDiv({ class: 'bm-preset-cell' })
                        .addSpan({ textContent: 'Full' }).up()
                        .addButton({ innerHTML: svgGrid.replace('#fff', '#2f4f4f'), 'aria-label': 'Preset "Full Template"' }, (ov, btn) => {
                            btn.onclick = () => this.#applyHighlightPreset('Full');
                        }).up()
                    .up()
                .up()
                .addParagraph({ id: 'bm-custom-label', textContent: 'Create a custom pattern:', style: 'font-weight: 700;' }).up()
                .addDiv({ class: 'bm-pixel-grid', role: 'group', 'aria-labelledby': 'bm-custom-label' });

        for (let col = -1; col <= 1; col++) {
            for (let row = -1; row <= 1; row++) {
                const existing = highlight[highlight.findIndex(([, c, r]) => c === col && r === row)]?.[0] ?? 0;
                let statusLabel = 'Disabled';
                if (existing === 1) statusLabel = 'Incorrect';
                else if (existing === 2) statusLabel = 'Template';
                this.addButton({ 'data-status': statusLabel, 'aria-label': `Sub-pixel ${statusLabel.toLowerCase()}` }, (ov, btn) => {
                    btn.onclick = () => this.#onSubpixelClick(btn, [col, row]);
                }).up();
            }
        }
        this.up().up().up().up();
    }

    buildTemplateSection() {
        this.addDiv({ class: 'bm-col' })
            .addHeading(2, { textContent: 'Template' }).up()
            .addHr().up()
            .addDiv({ class: 'bm-col', style: 'margin-left: 1.5ch;' })
                .addCheckbox({ textContent: 'Template creation should skip transparent tiles' }, (ov, label, input) => {
                    input.checked  = !this.settings?.flags?.includes('hl-noSkip');
                    input.onchange = e => this.toggleFlag('hl-noSkip', !e.target.checked);
                }).up()
                .addCheckbox({ innerHTML: 'Experimental: Template creation should <em>aggressively</em> skip transparent tiles' }, (ov, label, input) => {
                    input.checked  = !!this.settings?.flags?.includes('hl-agSkip');
                    input.onchange = e => this.toggleFlag('hl-agSkip', e.target.checked);
                }).up()
            .up()
        .up();
    }

    // ── Méthodes privées ──────────────────────────────────────

    async #autoSave() {
        const serialized = JSON.stringify(this.settings);
        if (serialized !== JSON.stringify(this.savedSettings) && Date.now() - this.lastSaveTimestamp > this.saveIntervalMs) {
            await GM.setValue(this.storageKey, serialized);
            this.savedSettings     = structuredClone(this.settings);
            this.lastSaveTimestamp = Date.now();
        }
    }

    #onSubpixelClick(btn, [col, row]) {
        btn.disabled = true;
        const highlight = this.settings?.highlight ?? [[1,0,1],[2,0,0],[1,-1,0],[1,1,0],[1,0,-1]];
        const statusMap = { Disabled: 'Incorrect', Incorrect: 'Template', Template: 'Disabled' };
        const modeMap   = { Disabled: [1, col, row], Incorrect: [2, col, row], Template: [0, col, row] };
        const nextStatus = statusMap[btn.dataset.status];
        const nextMode   = modeMap[btn.dataset.status];
        btn.dataset.status = nextStatus;
        btn.ariaLabel      = `Sub-pixel ${nextStatus.toLowerCase()}`;
        const existingIdx = highlight.findIndex(([, c, r]) => c === nextMode[1] && r === nextMode[2]);
        if (nextMode[0] !== 0) {
            if (existingIdx !== -1) highlight[existingIdx] = nextMode;
            else highlight.push(nextMode);
        } else {
            if (existingIdx !== -1) highlight.splice(existingIdx, 1);
        }
        this.settings.highlight = highlight;
        btn.disabled = false;
    }

    async #applyHighlightPreset(preset) {
        const buttons = document.querySelectorAll('.bm-preset-cell button');
        for (const btn of buttons) btn.disabled = true;
        const presets = {
            None:  [0, 0, 0, 0, 2, 0, 0, 0, 0],
            Cross: [0, 1, 0, 1, 2, 1, 0, 1, 0],
            X:     [1, 0, 1, 0, 2, 0, 1, 0, 1],
            Full:  [2, 2, 2, 2, 2, 2, 2, 2, 2]
        };
        const targetValues = presets[preset] ?? presets.None;
        const gridButtons  = document.querySelector('.bm-pixel-grid')?.childNodes ?? [];
        for (let i = 0; i < gridButtons.length; i++) {
            const cellBtn  = gridButtons[i];
            const statusMap = { Disabled: 0, Incorrect: 1, Template: 2 };
            const current  = statusMap[cellBtn.dataset.status] ?? 0;
            let delta = targetValues[i] - current;
            if (delta !== 0) {
                delta += delta < 0 ? 3 : 0;
                cellBtn.click();
                if (delta === 2) {
                    for (let t = 0; t < 200 && cellBtn.disabled; t += 10) await sleep(10);
                    cellBtn.click();
                }
            }
        }
        for (const btn of buttons) btn.disabled = false;
    }
}
