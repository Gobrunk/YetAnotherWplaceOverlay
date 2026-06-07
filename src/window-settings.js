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
                .addParagraph({ textContent: 'Settings take 5 seconds to save.' }).up()
                .addDiv({ class: 'yawo-col yawo-sections' }, () => {
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
        this.addDiv({ class: 'yawo-col' })
            .addHeading(2, { textContent: title }).up()
            .addHr().up()
            .addParagraph({ innerHTML: `An error occured loading the ${title} category. <code>SettingsManager</code> failed to override the ${title} function inside <code>WindowSettings</code>.` }).up()
        .up();
    }
}
