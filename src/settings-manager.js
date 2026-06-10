import { WindowSettings } from './windows/settings.js';

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
        this.settings.compact        ??= false;
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

    // The settings UI (toggle + section builders) lives in WindowSettings
    // (front/settings.js); this class only owns state + persistence.

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
