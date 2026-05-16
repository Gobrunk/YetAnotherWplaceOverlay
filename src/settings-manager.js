import { WindowSettings } from './window-settings.js';

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

}
