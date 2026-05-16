import { Overlay } from './overlay.js';
import { Template } from './template.js';
import { escapeHTML, decodeBase, formatNumber, formatDate } from './utils.js';

export class WindowWizard extends Overlay {
    constructor(name, version, requiredSchemaVersion, templateManager = undefined) {
        super(name, version);
        this.windowId              = 'yawo-window-wizard';
        this.mountTarget           = document.body;
        this.storedData            = JSON.parse(GM_getValue('yawoTemplates', '{}'));
        this.scriptVersion         = this.storedData?.scriptVersion;
        this.schemaVersion         = this.storedData?.schemaVersion;
        this.storageHealth         = undefined;
        this.requiredSchemaVersion = requiredSchemaVersion;
        this.templateManager       = templateManager;
    }

    toggle() {
        if (document.querySelector(`#${this.windowId}`)) {
            document.querySelector(`#${this.windowId}`).remove();
            return;
        }
        let extraStyle = '';
        if (!document.querySelector('#yawo-window-main')) extraStyle = 'z-index: 9001;';

        this.addDiv({ id: this.windowId, class: 'yawo-window', style: extraStyle })
            .addTitleBar()
                .addButton({ class: 'yawo-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Template Wizard"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                    btn.onclick    = () => overlay.toggleMinimize(btn);
                    btn.ontouchend = () => btn.click();
                }).up()
                .addDiv().up()
                .addButton({ class: 'yawo-chrome-btn', textContent: '✖', 'aria-label': 'Close window "Template Wizard"' }, (overlay, btn) => {
                    btn.onclick    = () => document.querySelector(`#${this.windowId}`)?.remove();
                    btn.ontouchend = () => btn.click();
                }).up()
            .up()
            .addDiv({ class: 'yawo-content' })
                .addDiv({ class: 'yawo-col yawo-spaced' })
                    .addHeading(1, { textContent: 'Template Wizard' }).up()
                .up()
                .addHr().up()
                .addDiv({ class: 'yawo-col' })
                    .addHeading(2, { textContent: 'Status' }).up()
                    .addParagraph({ id: 'yawo-wizard-status', textContent: 'Loading template storage status...' }).up()
                .up()
                .addDiv({ class: 'yawo-col yawo-sections' })
                    .addHeading(2, { textContent: 'Detected templates:' }).up()
                .up()
            .up()
        .mount(this.mountTarget);
        this.enableDragging(`#${this.windowId}.yawo-window`, `#${this.windowId} .yawo-titlebar`);
        this.#buildStatusSection();
        this.#buildTemplateList();
    }

    // ── Méthodes privées ──────────────────────────────────────

    #buildStatusSection() {
        const stored  = this.schemaVersion?.split(/[-\.+]/) ?? [];
        const current = this.requiredSchemaVersion.split(/[-\.+]/);
        let statusHTML = '';

        if (stored[0] === current[0]) {
            if (stored[1] === current[1]) {
                statusHTML = 'Template storage health: <b style="color:#0f0;">Healthy!</b><br>No further action required. (Reason: Semantic version matches)';
                this.storageHealth = 'Good';
            } else {
                statusHTML = 'Template storage health: <b style="color:#ff0;">Poor!</b><br>You can still use your template, but some features may not work. It is recommended that you update Yet Another Wplace Overlay\'s template storage. (Reason: MINOR version mismatch)';
                this.storageHealth = 'Poor';
            }
        } else if (stored[0] < current[0]) {
            statusHTML = 'Template storage health: <b style="color:#f00;">Bad!</b><br>It is guaranteed that some features are broken. You <em>might</em> still be able to use the template. It is HIGHLY recommended that you download all templates and update Yet Another Wplace Overlay\'s template storage before continuing. (Reason: MAJOR version mismatch)';
            this.storageHealth = 'Bad';
        } else {
            statusHTML = 'Template storage health: <b style="color:#f00">Dead!</b><br>Yet Another Wplace Overlay can not load the template storage. (Reason: MAJOR version unknown)';
            this.storageHealth = 'Dead';
        }

        const upgradeNotice = `<hr style="margin:.5ch">If you want to continue using your current templates, then make sure the template storage (schema) is up-to-date.<br>If you don't want to update the template storage, then downgrade Yet Another Wplace Overlay to version <b>${escapeHTML(this.scriptVersion)}</b> to continue using your templates.<br>Alternatively, if you don't care about corrupting the templates listed below, you can fix any issues with the template storage by uploading a new template.`;

        const wplaceVersionEl = [...document.querySelectorAll('body > div > .hidden')].filter(el => /version:/i.test(el.textContent))[0];
        let wplaceVersionDate = '???';
        if (wplaceVersionEl) {
            const match = wplaceVersionEl.textContent?.match(/\d+/);
            if (match) wplaceVersionDate = formatDate(new Date(Number(match[0])));
        }

        this.setElementContent('yawo-wizard-status', `${statusHTML}<br>Your templates were created during Yet Another Wplace Overlay version <b>${escapeHTML(this.scriptVersion)}</b> with schema version <b>${escapeHTML(this.schemaVersion)}</b>.<br>The current Yet Another Wplace Overlay version is <b>${escapeHTML(this.version)}</b> and requires schema version <b>${escapeHTML(this.requiredSchemaVersion)}</b>.<br>Wplace was last updated on <b>${wplaceVersionDate}</b>.${this.storageHealth !== 'Good' ? upgradeNotice : ''}`);

        const actionBuilder = new Overlay(this.name, this.version);
        if (this.storageHealth !== 'Dead') {
            actionBuilder.addDiv({ class: 'yawo-col yawo-row yawo-spaced', style: 'gap: 1.5ch;' })
                .addButton({ textContent: 'Download all templates' }, (ov, btn) => {
                    btn.onclick = () => { btn.disabled = true; this.templateManager.downloadAllTemplates().then(() => { btn.disabled = false; }); };
                }).up();
        }
        if (this.storageHealth === 'Poor' || this.storageHealth === 'Bad') {
            actionBuilder.addButton({ textContent: `Update template storage to ${this.requiredSchemaVersion}` }, (ov, btn) => {
                btn.onclick = () => { btn.disabled = true; this.#upgradeStorage(true); };
            }).up();
        }
        if (this.storageHealth !== 'Dead') actionBuilder.up();
        actionBuilder.mount(document.querySelector('#yawo-wizard-status').parentNode);
    }

    #buildTemplateList() {
        const templates = this.storedData?.templates;
        if (!templates || Object.keys(templates).length === 0) return;

        const sectionsEl  = document.querySelector(`#${this.windowId} .yawo-sections`);
        const listBuilder = new Overlay(this.name, this.version);
        listBuilder.addDiv({ id: 'yawo-wizard-list', class: 'yawo-col' });

        for (const key in templates) {
            if (!templates.hasOwnProperty(key)) continue;
            const entry      = templates[key];
            const parts      = key.split(' ');
            const sortId     = Number(parts?.[0]);
            const authorId   = decodeBase(parts?.[1] || '0', this.templateManager.encodeAlphabet);
            const name       = entry.name || `Template ${sortId || ''}`;
            const coords     = entry?.coords?.split(',').map(Number);
            const pixelTotal = entry.pixels?.total ?? undefined;
            const sortIdStr  = typeof sortId   === 'number' ? formatNumber(sortId)     : '???';
            const authorStr  = typeof authorId === 'number' ? formatNumber(authorId)   : '???';
            const pixelStr   = typeof pixelTotal === 'number' ? formatNumber(pixelTotal) : '???';

            listBuilder.addDiv({ class: 'yawo-col yawo-row' })
                .addDiv({ class: 'yawo-row', style: 'flex-direction: column; gap: 0;' })
                    .addDiv({ class: 'yawo-template-thumb', textContent: '🖼️' }).up()
                    .addSmall({ textContent: `#${sortIdStr}` }).up()
                .up()
                .addDiv({ class: 'yawo-row yawo-template-info' })
                    .addHeading(3, { textContent: name }).up()
                    .addSpan({ textContent: `Uploaded by user #${authorStr}` }).up()
                    .addSpan({ textContent: `Coordinates: ${coords.join(', ')}` }).up()
                    .addSpan({ textContent: `Total Pixels: ${pixelStr}` }).up()
                .up()
            .up();
        }
        listBuilder.up().mount(sectionsEl);
    }

    async #upgradeStorage(showUI) {
        if (showUI) {
            const contentEl = document.querySelector(`#${this.windowId} .yawo-content`);
            contentEl.innerHTML = '';
            new Overlay(this.name, this.version)
                .addDiv({ class: 'yawo-col' })
                    .addDiv({ class: 'yawo-col yawo-spaced' })
                        .addHeading(1, { textContent: 'Template Wizard' }).up()
                    .up()
                    .addHr().up()
                    .addDiv({ class: 'yawo-col' })
                        .addHeading(2, { textContent: 'Status' }).up()
                        .addParagraph({ textContent: 'Updating template storage. Please wait...' }).up()
                    .up()
                .up()
            .mount(contentEl);
        }
        GM_deleteValue('yawoCoords');
        const templates = this.storedData?.templates;
        if (templates && Object.keys(templates).length > 0) {
            for (const [key, entry] of Object.entries(templates)) {
                if (!templates.hasOwnProperty(key)) {
                    const tmpl = new Template({ displayName: entry.name, tiles: entry.tiles });
                    tmpl.inferCoordsFromTiles();
                    const blob = await this.templateManager.compositeTemplateTiles(tmpl);
                    await this.templateManager.createTemplate(blob, tmpl.displayName, tmpl.coords);
                }
            }
        }
        if (showUI) {
            document.querySelector(`#${this.windowId}`)?.remove();
            new WindowWizard(this.name, this.version, this.requiredSchemaVersion, this.templateManager).toggle();
        }
    }
}
