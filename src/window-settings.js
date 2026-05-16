import { Overlay } from './overlay.js';

export class WindowSettings extends Overlay {
    constructor(name, version) {
        super(name, version);
        this.windowId    = 'bm-window-settings';
        this.mountTarget = document.body;
    }

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            document.querySelector(`#${this.windowId}`).remove();
            return;
        }
        this.addDiv({ id: this.windowId, class: 'bm-window' })
            .addTitleBar()
                .addButton({ class: 'bm-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Settings"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                    btn.onclick    = () => overlay.toggleMinimize(btn);
                    btn.ontouchend = () => btn.click();
                }).up()
                .addDiv().up()
                .addDiv({ class: 'bm-row' })
                    .addButton({ class: 'bm-chrome-btn', textContent: '✖', 'aria-label': 'Close window "Settings"' }, (overlay, btn) => {
                        btn.onclick    = () => document.querySelector(`#${this.windowId}`)?.remove();
                        btn.ontouchend = () => btn.click();
                    }).up()
                .up()
            .up()
            .addDiv({ class: 'bm-content' })
                .addDiv({ class: 'bm-col bm-spaced' })
                    .addHeading(1, { textContent: 'Settings' }).up()
                .up()
                .addHr().up()
                .addParagraph({ textContent: 'Settings take 5 seconds to save.' }).up()
                .addDiv({ class: 'bm-col bm-sections' }, () => {
                    this.buildTemplateSection();
                }).up()
            .up()
        .mount(this.mountTarget);
        this.enableDragging(`#${this.windowId}.bm-window`, `#${this.windowId} .bm-titlebar`);
    }

    buildTemplateSection() {
        this.#buildPlaceholderSection('Template');
    }

    #buildPlaceholderSection(title) {
        this.addDiv({ class: 'bm-col' })
            .addHeading(2, { textContent: title }).up()
            .addHr().up()
            .addParagraph({ innerHTML: `An error occured loading the ${title} category. <code>SettingsManager</code> failed to override the ${title} function inside <code>WindowSettings</code>.` }).up()
        .up();
    }
}
