import { Overlay } from './overlay.js';

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
                .addSmall({ textContent: 'Settings take 5 seconds to save.', class: 'yawo-form-label' }).up()
                .addDiv({ class: 'yawo-col yawo-settings-sections' }, () => {
                    this.buildTemplateSection();
                    this.buildOverlaySection();
                    this.buildNavigationSection();
                }).up()
            .up()
            .addWindowFooter({ version: this.version })
        .mount(this.mountTarget);
        const savedPos = this.settings?.settingsWindowPosition;
        if (savedPos?.x !== undefined && savedPos?.y !== undefined) {
            const winEl = document.querySelector(`#${this.windowId}`);
            if (winEl) {
                winEl.style.transform = `translate(${savedPos.x}px, ${savedPos.y}px)`;
                winEl.style.left = '0px';
                winEl.style.top  = '0px';
            }
        }
        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar`, (x, y) => {
            if (this.settings) { this.settings.settingsWindowPosition = { x, y }; this.persist?.(); }
        });
        this.enableResizing(
            `#${this.windowId}.yawo-window`,
            (w, h) => { if (this.settings) { this.settings.settingsWindowSize = { w, h }; this.persist?.(); } },
            this.settings?.settingsWindowSize
        );
    }

    buildTemplateSection() {
        this.#buildPlaceholderSection('Template');
    }

    buildOverlaySection() {
        this.#buildPlaceholderSection('Overlay');
    }

    buildNavigationSection() {
        this.#buildPlaceholderSection('Navigation');
    }

    #buildPlaceholderSection(title) {
        this.addDiv({ class: 'yawo-settings-card' })
            .addDiv({ class: 'yawo-card-header' })
                .addSpan({ textContent: '⚠️', class: 'yawo-card-badge yawo-badge-nav' }).up()
                .addHeading(2, { textContent: title, class: 'yawo-card-title' }).up()
            .up()
            .addDiv({ class: 'yawo-card-body' })
                .addParagraph({ innerHTML: `An error occured loading the ${title} category. <code>SettingsManager</code> failed to override the ${title} function inside <code>WindowSettings</code>.` }).up()
            .up()
        .up();
    }
}
