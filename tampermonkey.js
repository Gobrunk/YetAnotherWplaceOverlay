// ==UserScript==
// @name            Yet Another Wplace Overlay
// @name:en         Yet Another Wplace Overlay
// @version         0.1.0
// @description     A userscript to enhance the user experience on Wplace.live. This includes, but is not limited to: uploading images to display locally on a canvas, adding a button to move the Wplace color palette menu, and other QoL features.
// @description:en  A userscript to enhance the user experience on Wplace.live. This includes, but is not limited to: uploading images to display locally on a canvas, adding a button to move the Wplace color palette menu, and other QoL features.
// @author          Gobrunk
// @license         MPL-2.0
// @match           https://wplace.live/*
// @grant           GM_addStyle
// @grant           GM.setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @grant           GM.download
// @noframes
// @run-at          document-start
// ==/UserScript==

// Wplace  --> https://wplace.live
// License --> https://www.mozilla.org/en-US/MPL/2.0/
(function () {
    'use strict';

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function formatNumber(n) {
        return new Intl.NumberFormat().format(n);
    }

    function formatPercent(ratio) {
        return new Intl.NumberFormat(undefined, {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(ratio);
    }

    function formatDate(date) {
        return date.toLocaleString(undefined, {
            weekday: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function consoleLog(...args) {
        (0, console.log)(...args);
    }

    function consoleError(...args) {
        (0, console.error)(...args);
    }

    function consoleWarn(...args) {
        (0, console.warn)(...args);
    }

    function encodeBase(n, alphabet) {
        if (n === 0) return alphabet[0];
        let result = '';
        const base = alphabet.length;
        while (n > 0) {
            result = alphabet[n % base] + result;
            n = Math.floor(n / base);
        }
        return result;
    }

    function decodeBase(str, alphabet) {
        let result = 0;
        const base = alphabet.length;
        for (const char of str) {
            const idx = alphabet.indexOf(char);
            if (idx === -1) consoleError(`Invalid character '${char}' encountered whilst decoding! Is the decode alphabet/base incorrect?`);
            result = result * base + idx;
        }
        return result;
    }

    function uint8ToBase64(arr) {
        let str = '';
        for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
        return btoa(str);
    }

    function base64ToUint8(str) {
        const binary = atob(str);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        return arr;
    }

    function calculateLuminance(rgb) {
        const channels = rgb.map(c => {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    function rgbToHex(r, g, b) {
        if (Array.isArray(r)) ([r, g, b] = r);
        return (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
    }

    class Template {
        constructor({
            displayName = 'My template',
            sortId      = 0,
            authorId    = '',
            url         = '',
            file        = null,
            coords      = null,
            tiles       = null,
            pixelData   = {},
            tileSize    = 1000
        } = {}) {
            this.displayName      = displayName;
            this.sortId           = sortId;
            this.authorId         = authorId;
            this.url              = url;
            this.file             = file;
            this.coords           = coords;
            this.tiles            = tiles;
            this.pixelData        = pixelData;
            this.tileSize         = tileSize;
            this.pixelStats       = { total: 0, colors: new Map() };
            this.skipTransparent  = true;
            this.aggressiveSkip   = false;
        }

        async processImage(tileSize, paletteCache, skipTransparent, aggressiveSkip) {
            this.skipTransparent = skipTransparent;
            this.aggressiveSkip  = aggressiveSkip;
            const bitmap = await createImageBitmap(this.file);
            const imgW   = bitmap.width;
            const imgH   = bitmap.height;
            this.tileSize = tileSize;

            const tileCanvas  = new OffscreenCanvas(this.tileSize, this.tileSize);
            const tileCtx     = tileCanvas.getContext('2d', { willReadFrequently: true });
            const maskCanvas  = new OffscreenCanvas(this.tileSize, this.tileSize);
            const maskCtx     = maskCanvas.getContext('2d', { willReadFrequently: true });
            maskCtx.globalCompositeOperation = 'destination-over';
            tileCanvas.width  = imgW;
            tileCanvas.height = imgH;
            tileCtx.imageSmoothingEnabled = false;
            tileCtx.drawImage(bitmap, 0, 0);

            const colorMap = this.#countPixelColors(tileCtx.getImageData(0, 0, imgW, imgH), paletteCache);
            let totalPixels = 0;
            for (const [colorId, count] of colorMap) {
                if (colorId !== 0) totalPixels += count;
            }
            this.pixelStats = { total: totalPixels, colors: colorMap };

            const dotCanvas = new OffscreenCanvas(3, 3);
            const dotCtx    = dotCanvas.getContext('2d');
            dotCtx.clearRect(0, 0, 3, 3);
            dotCtx.fillStyle = 'white';
            dotCtx.fillRect(1, 1, 1, 1);

            const imageBitmaps = {};
            const base64Tiles  = {};

            for (let py = this.coords[3]; py < imgH + this.coords[3];) {
                const chunkH = Math.min(this.tileSize - py % this.tileSize, imgH - (py - this.coords[3]));
                for (let px = this.coords[2]; px < imgW + this.coords[2];) {
                    const chunkW = Math.min(this.tileSize - px % this.tileSize, imgW - (px - this.coords[2]));
                    if (skipTransparent && !this.checkTileHasContent({
                        imageBitmap: bitmap,
                        sourceRect:  [px - this.coords[2], py - this.coords[3], chunkW, chunkH],
                        maskCanvas,
                        maskCtx
                    })) {
                        px += chunkW;
                        continue;
                    }
                    const scaledW = 3 * chunkW;
                    const scaledH = 3 * chunkH;
                    tileCanvas.width  = scaledW;
                    tileCanvas.height = scaledH;
                    tileCtx.imageSmoothingEnabled = false;
                    tileCtx.clearRect(0, 0, scaledW, scaledH);
                    tileCtx.drawImage(bitmap, px - this.coords[2], py - this.coords[3], chunkW, chunkH, 0, 0, scaledW, scaledH);
                    tileCtx.save();
                    tileCtx.globalCompositeOperation = 'destination-in';
                    tileCtx.fillStyle = tileCtx.createPattern(dotCanvas, 'repeat');
                    tileCtx.fillRect(0, 0, scaledW, scaledH);
                    tileCtx.restore();

                    const tileKey = `${(this.coords[0] + Math.floor(px / 1000)).toString().padStart(4, '0')},${(this.coords[1] + Math.floor(py / 1000)).toString().padStart(4, '0')},${(px % 1000).toString().padStart(3, '0')},${(py % 1000).toString().padStart(3, '0')}`;
                    const imageData = tileCtx.getImageData(0, 0, scaledW, scaledH);
                    this.pixelData[tileKey] = new Uint32Array(imageData.data.buffer);
                    imageBitmaps[tileKey]   = await createImageBitmap(tileCanvas);

                    const blob  = await tileCanvas.convertToBlob();
                    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
                    base64Tiles[tileKey] = uint8ToBase64(bytes);
                    px += chunkW;
                }
                py += chunkH;
            }
            return { imageBitmaps, base64Tiles };
        }

        checkTileHasContent({ imageBitmap, sourceRect, maskCanvas, maskCtx }) {
            const sampleOffsets = [
                [0,1],[1,0],[0,-2],[-2,0],[0,4],[4,0],[0,-8],[-8,0],[0,16],[16,0],[0,-32],[-32,0]
            ];
            const [, , w, h] = sourceRect;
            maskCanvas.width  = w;
            maskCanvas.height = h;
            maskCtx.clearRect(0, 0, w, h);
            if (this.aggressiveSkip) {
                maskCtx.drawImage(imageBitmap, ...sourceRect, 0, 0, 10, 10);
            } else {
                maskCtx.drawImage(imageBitmap, ...sourceRect, 0, 0, w, h);
                for (const [dx, dy] of sampleOffsets)
                    maskCtx.drawImage(maskCanvas, 0, 0, w, h, dx, dy, w, h);
                maskCtx.drawImage(maskCanvas, 0, 0, w, h, 0, 0, 10, 10);
            }
            const pixels = new Uint32Array(maskCtx.getImageData(0, 0, 10, 10).data.buffer);
            for (const pixel of pixels) if (pixel) return true;
            return false;
        }

        inferCoordsFromTiles() {
            let topLeft = [Infinity, Infinity, Infinity, Infinity];
            Object.keys(this.tiles).sort().forEach(key => {
                const [tileX, tileY, pixelX, pixelY] = key.split(',').map(Number);
                if (tileY < topLeft[1] || (tileY === topLeft[1] && tileX < topLeft[0]))
                    topLeft = [tileX, tileY, pixelX, pixelY];
            });
            this.coords = topLeft;
        }

        // ── Méthodes privées ──────────────────────────────────────

        #countPixelColors(imageData, paletteCache) {
            const pixels    = new Uint32Array(imageData.data.buffer);
            const { jt: colorLookup } = paletteCache;
            const colorMap  = new Map();
            for (const pixel of pixels) {
                const colorId = pixel >>> 24 === 0 ? 0 : (colorLookup.get(pixel) ?? -2);
                colorMap.set(colorId, (colorMap.get(colorId) ?? 0) + 1);
            }
            return colorMap;
        }
    }

    const COLOR_PALETTE = [
        { id: 0,  premium: false, name: 'Transparent',      rgb: [0, 0, 0] },
        { id: 1,  premium: false, name: 'Black',            rgb: [0, 0, 0] },
        { id: 2,  premium: false, name: 'Dark Gray',        rgb: [60, 60, 60] },
        { id: 3,  premium: false, name: 'Gray',             rgb: [120, 120, 120] },
        { id: 4,  premium: false, name: 'Light Gray',       rgb: [210, 210, 210] },
        { id: 5,  premium: false, name: 'White',            rgb: [255, 255, 255] },
        { id: 6,  premium: false, name: 'Deep Red',         rgb: [96, 0, 24] },
        { id: 7,  premium: false, name: 'Red',              rgb: [237, 28, 36] },
        { id: 8,  premium: false, name: 'Orange',           rgb: [255, 127, 39] },
        { id: 9,  premium: false, name: 'Gold',             rgb: [246, 170, 9] },
        { id: 10, premium: false, name: 'Yellow',           rgb: [249, 221, 59] },
        { id: 11, premium: false, name: 'Light Yellow',     rgb: [255, 250, 188] },
        { id: 12, premium: false, name: 'Dark Green',       rgb: [14, 185, 104] },
        { id: 13, premium: false, name: 'Green',            rgb: [19, 230, 123] },
        { id: 14, premium: false, name: 'Light Green',      rgb: [135, 255, 94] },
        { id: 15, premium: false, name: 'Dark Teal',        rgb: [12, 129, 110] },
        { id: 16, premium: false, name: 'Teal',             rgb: [16, 174, 166] },
        { id: 17, premium: false, name: 'Light Teal',       rgb: [19, 225, 190] },
        { id: 18, premium: false, name: 'Dark Blue',        rgb: [40, 80, 158] },
        { id: 19, premium: false, name: 'Blue',             rgb: [64, 147, 228] },
        { id: 20, premium: false, name: 'Cyan',             rgb: [96, 247, 242] },
        { id: 21, premium: false, name: 'Indigo',           rgb: [107, 80, 246] },
        { id: 22, premium: false, name: 'Light Indigo',     rgb: [153, 177, 251] },
        { id: 23, premium: false, name: 'Dark Purple',      rgb: [120, 12, 153] },
        { id: 24, premium: false, name: 'Purple',           rgb: [170, 56, 185] },
        { id: 25, premium: false, name: 'Light Purple',     rgb: [224, 159, 249] },
        { id: 26, premium: false, name: 'Dark Pink',        rgb: [203, 0, 122] },
        { id: 27, premium: false, name: 'Pink',             rgb: [236, 31, 128] },
        { id: 28, premium: false, name: 'Light Pink',       rgb: [243, 141, 169] },
        { id: 29, premium: false, name: 'Dark Brown',       rgb: [104, 70, 52] },
        { id: 30, premium: false, name: 'Brown',            rgb: [149, 104, 42] },
        { id: 31, premium: false, name: 'Beige',            rgb: [248, 178, 119] },
        { id: 32, premium: true,  name: 'Medium Gray',      rgb: [170, 170, 170] },
        { id: 33, premium: true,  name: 'Dark Red',         rgb: [165, 14, 30] },
        { id: 34, premium: true,  name: 'Light Red',        rgb: [250, 128, 114] },
        { id: 35, premium: true,  name: 'Dark Orange',      rgb: [228, 92, 26] },
        { id: 36, premium: true,  name: 'Light Tan',        rgb: [214, 181, 148] },
        { id: 37, premium: true,  name: 'Dark Goldenrod',   rgb: [156, 132, 49] },
        { id: 38, premium: true,  name: 'Goldenrod',        rgb: [197, 173, 49] },
        { id: 39, premium: true,  name: 'Light Goldenrod',  rgb: [232, 212, 95] },
        { id: 40, premium: true,  name: 'Dark Olive',       rgb: [74, 107, 58] },
        { id: 41, premium: true,  name: 'Olive',            rgb: [90, 148, 74] },
        { id: 42, premium: true,  name: 'Light Olive',      rgb: [132, 197, 115] },
        { id: 43, premium: true,  name: 'Dark Cyan',        rgb: [15, 121, 159] },
        { id: 44, premium: true,  name: 'Light Cyan',       rgb: [187, 250, 242] },
        { id: 45, premium: true,  name: 'Light Blue',       rgb: [125, 199, 255] },
        { id: 46, premium: true,  name: 'Dark Indigo',      rgb: [77, 49, 184] },
        { id: 47, premium: true,  name: 'Dark Slate Blue',  rgb: [74, 66, 132] },
        { id: 48, premium: true,  name: 'Slate Blue',       rgb: [122, 113, 196] },
        { id: 49, premium: true,  name: 'Light Slate Blue', rgb: [181, 174, 241] },
        { id: 50, premium: true,  name: 'Light Brown',      rgb: [219, 164, 99] },
        { id: 51, premium: true,  name: 'Dark Beige',       rgb: [209, 128, 81] },
        { id: 52, premium: true,  name: 'Light Beige',      rgb: [255, 197, 165] },
        { id: 53, premium: true,  name: 'Dark Peach',       rgb: [155, 82, 73] },
        { id: 54, premium: true,  name: 'Peach',            rgb: [209, 128, 120] },
        { id: 55, premium: true,  name: 'Light Peach',      rgb: [250, 182, 164] },
        { id: 56, premium: true,  name: 'Dark Tan',         rgb: [123, 99, 82] },
        { id: 57, premium: true,  name: 'Tan',              rgb: [156, 132, 107] },
        { id: 58, premium: true,  name: 'Dark Slate',       rgb: [51, 57, 65] },
        { id: 59, premium: true,  name: 'Slate',            rgb: [109, 117, 141] },
        { id: 60, premium: true,  name: 'Light Slate',      rgb: [179, 185, 209] },
        { id: 61, premium: true,  name: 'Dark Stone',       rgb: [109, 100, 63] },
        { id: 62, premium: true,  name: 'Stone',            rgb: [148, 140, 107] },
        { id: 63, premium: true,  name: 'Light Stone',      rgb: [205, 197, 158] },
    ];

    class Overlay {
        #rootElement   = null;
        #currentParent = null;
        #parentStack   = [];
        #statusAreaId  = 'bm-status';

        constructor(name, version) {
            this.name           = name;
            this.version        = version;
            this.apiManager     = null;
            this.settingsManager = null;
        }

        // ── Injection de dépendances ──────────────────────────────

        setApiManager(mgr)      { this.apiManager = mgr; }
        setSettingsManager(mgr) { this.settingsManager = mgr; }

        // ── Navigation dans la hiérarchie ─────────────────────────

        up() {
            if (this.#parentStack.length > 0)
                this.#currentParent = this.#parentStack.pop();
            return this;
        }

        mount(target) {
            target?.appendChild(this.#rootElement);
            this.#rootElement   = null;
            this.#currentParent = null;
            this.#parentStack   = [];
        }

        // ── Création d'éléments ───────────────────────────────────

        #createElement(tag, defaults = {}, attrs = {}) {
            const el = document.createElement(tag);
            if (this.#rootElement) {
                this.#currentParent?.appendChild(el);
                this.#parentStack.push(this.#currentParent);
                this.#currentParent = el;
            } else {
                this.#rootElement   = el;
                this.#currentParent = el;
            }
            for (const [key, val] of Object.entries(defaults)) this.#applyAttribute(el, key, val);
            for (const [key, val] of Object.entries(attrs))    this.#applyAttribute(el, key, val);
            return el;
        }

        #applyAttribute(el, key, val) {
            if      (key === 'class')     el.classList.add(...val.split(/\s+/));
            else if (key === 'for')       el.htmlFor = val;
            else if (key === 'tabindex')  el.tabIndex = Number(val);
            else if (key === 'readonly')  el.readOnly = val === 'true' || val === '1';
            else if (key === 'maxlength') el.maxLength = Number(val);
            else if (key.startsWith('data')) {
                el.dataset[key.slice(5).split('-').map((s, i) => i === 0 ? s : s[0].toUpperCase() + s.slice(1)).join('')] = val;
            }
            else if (key.startsWith('aria')) el.setAttribute(key, val);
            else el[key] = val;
        }

        // ── Éléments HTML standards ───────────────────────────────

        addDiv(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('div', {}, attrs));
            return this;
        }

        addParagraph(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('p', {}, attrs));
            return this;
        }

        addSmall(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('small', {}, attrs));
            return this;
        }

        addSpan(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('span', {}, attrs));
            return this;
        }

        addDetails(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('details', {}, attrs));
            return this;
        }

        addSummary(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('summary', {}, attrs));
            return this;
        }

        addImage(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('img', {}, attrs));
            return this;
        }

        addHeading(level, attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('h' + level, {}, attrs));
            return this;
        }

        addHr(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('hr', {}, attrs));
            return this;
        }

        addBr(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('br', {}, attrs));
            return this;
        }

        addForm(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('form', {}, attrs));
            return this;
        }

        addFieldset(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('fieldset', {}, attrs));
            return this;
        }

        addLegend(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('legend', {}, attrs));
            return this;
        }

        // ── Éléments de formulaire ────────────────────────────────

        addCheckbox(attrs = {}, cb = () => {}) {
            const labelContent = {};
            if (attrs.textContent)  { labelContent.textContent = attrs.textContent; delete attrs.textContent; }
            else if (attrs.innerHTML) { labelContent.innerHTML = attrs.innerHTML;   delete attrs.innerHTML;   }
            const labelEl = this.#createElement('label', labelContent);
            const inputEl = this.#createElement('input', { type: 'checkbox' }, attrs);
            labelEl.insertBefore(inputEl, labelEl.firstChild);
            this.up();
            cb(this, labelEl, inputEl);
            return this;
        }

        addSelect(attrs = {}, cb = () => {}) {
            const labelEl = this.#createElement('label', {
                textContent: attrs.textContent ?? '',
                for: attrs.id ?? ''
            });
            delete attrs.textContent;
            this.up();
            const selectEl = this.#createElement('select', {}, attrs);
            cb(this, labelEl, selectEl);
            return this;
        }

        addOption(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('option', {}, attrs));
            return this;
        }

        addInput(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('input', {}, attrs));
            return this;
        }

        addFileInput(attrs = {}, cb = () => {}) {
            const buttonLabel = attrs.textContent ?? '';
            delete attrs.textContent;
            const wrapperEl = this.#createElement('div');
            const inputEl   = this.#createElement('input', { type: 'file', tabIndex: -1, 'aria-hidden': 'true' }, attrs);
            this.up();
            const buttonEl  = this.#createElement('button', { textContent: buttonLabel });
            this.up();
            this.up();
            buttonEl.addEventListener('click', () => inputEl.click());
            inputEl.addEventListener('change', () => {
                buttonEl.style.maxWidth = `${buttonEl.offsetWidth}px`;
                buttonEl.textContent = inputEl.files.length > 0 ? inputEl.files[0].name : buttonLabel;
            });
            cb(this, wrapperEl, inputEl, buttonEl);
            return this;
        }

        addTextarea(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('textarea', {}, attrs));
            return this;
        }

        addButton(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('button', {}, attrs));
            return this;
        }

        addHelpButton(attrs = {}, cb = () => {}) {
            const title = attrs.title ?? attrs.textContent ?? 'Help: No info';
            delete attrs.textContent;
            attrs.title = `Help: ${title}`;
            const buttonEl = this.#createElement('button', {
                textContent: '?',
                className:   'bm-info-btn',
                onclick:     () => this.setElementContent(this.#statusAreaId, title)
            }, attrs);
            cb(this, buttonEl);
            return this;
        }

        // ── Listes ────────────────────────────────────────────────

        addOrderedList(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('ol', {}, attrs));
            return this;
        }

        addUnorderedList(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('ul', {}, attrs));
            return this;
        }

        addMenu(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('menu', {}, attrs));
            return this;
        }

        addListItem(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('li', {}, attrs));
            return this;
        }

        // ── Tableaux ──────────────────────────────────────────────

        addTable(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('table', {}, attrs));
            return this;
        }

        addTableCaption(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('caption', {}, attrs));
            return this;
        }

        addTableHead(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('thead', {}, attrs));
            return this;
        }

        addTableBody(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('tbody', {}, attrs));
            return this;
        }

        addTableFoot(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('tfoot', {}, attrs));
            return this;
        }

        addTableRow(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('tr', {}, attrs));
            return this;
        }

        addTableHeaderCell(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('th', {}, attrs));
            return this;
        }

        addTableDataCell(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('td', {}, attrs));
            return this;
        }

        // ── Éléments spéciaux ─────────────────────────────────────

        addTitleBar(attrs = {}, cb = () => {}) {
            cb(this, this.#createElement('div', { class: 'bm-titlebar' }, attrs));
            return this;
        }

        addCountdownTimer(endTimestamp = Date.now(), intervalMs = 500, attrs = {}, cb = () => {}) {
            const id = attrs.id || 'bm-countdown-' + crypto.randomUUID().slice(0, 8);
            const timeEl = this.#createElement('time', { class: 'bm-countdown' }, attrs);
            timeEl.id = id;
            timeEl.dataset.endDate = endTimestamp;
            setInterval(() => {
                if (!timeEl.isConnected) return;
                const remaining = Math.max(timeEl.dataset.endDate - Date.now(), 0);
                const totalSec  = Math.floor(remaining / 1000);
                const hours     = Math.floor(totalSec / 3600);
                const seconds   = Math.floor(totalSec % 60);
                const minutes   = Math.floor(totalSec % 3600 / 60);
                timeEl.setAttribute('datetime', `PT${hours}H${minutes}M${seconds}S`);
                timeEl.textContent = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
            }, intervalMs);
            cb(this, timeEl);
            return this;
        }

        // ── Manipulation du DOM ───────────────────────────────────

        setElementContent(id, value, useTextContent = false) {
            const el = document.getElementById(id.replace(/^#/, ''));
            if (!el) return;
            if (el instanceof HTMLInputElement) el.value = value;
            else if (useTextContent)            el.textContent = value;
            else                                el.innerHTML = value;
        }

        setStatus(msg) {
            (0, console.info)(`${this.name}: ${msg}`);
            this.setElementContent(this.#statusAreaId, 'Status: ' + msg, true);
        }

        setError(msg) {
            (0, console.error)(`${this.name}: ${msg}`);
            this.setElementContent(this.#statusAreaId, 'Error: ' + msg, true);
        }

        // ── Fenêtre : minimize / drag ─────────────────────────────

        toggleMinimize(btn) {
            if (btn.disabled) return;
            btn.disabled = true;
            btn.style.textDecoration = 'none';
            const windowEl  = btn.closest('.bm-window');
            const titlebar  = btn.closest('.bm-titlebar');
            const heading   = windowEl.querySelector('h1');
            const contentEl = windowEl.querySelector('.bm-content');
            if (windowEl.parentElement) windowEl.parentElement.append(windowEl);
            if ('expanded' === btn.dataset.buttonStatus) {
                contentEl.style.height = contentEl.scrollHeight + 'px';
                windowEl.style.width   = windowEl.scrollWidth + 'px';
                contentEl.style.height = '0';
                contentEl.addEventListener('transitionend', function handler() {
                    contentEl.style.display = 'none';
                    btn.disabled = false;
                    btn.style.textDecoration = '';
                    contentEl.removeEventListener('transitionend', handler);
                });
                const clone = heading.cloneNode(true);
                const label = clone.textContent;
                btn.nextElementSibling.appendChild(clone);
                btn.textContent = '▶';
                btn.dataset.buttonStatus = 'collapsed';
                btn.ariaLabel = `Unminimize window "${label}"`;
            } else {
                const inlineHeading = titlebar.querySelector('h1');
                const label         = inlineHeading.textContent;
                inlineHeading.remove();
                contentEl.style.display = '';
                contentEl.style.height  = '0';
                windowEl.style.width    = '';
                contentEl.style.height  = contentEl.scrollHeight + 'px';
                contentEl.addEventListener('transitionend', function handler() {
                    contentEl.style.height = '';
                    btn.disabled = false;
                    btn.style.textDecoration = '';
                    contentEl.removeEventListener('transitionend', handler);
                });
                btn.textContent = '▼';
                btn.dataset.buttonStatus = 'expanded';
                btn.ariaLabel = `Minimize window "${label}"`;
            }
        }

        enableDragging(windowSelector, handleSelector) {
            const windowEl = document.querySelector(windowSelector);
            const handleEl = document.querySelector(handleSelector);
            if (!windowEl || !handleEl) {
                this.setError(`Can not drag! ${windowEl ? '' : windowSelector} ${windowEl || handleEl ? '' : 'and '}${handleEl ? '' : handleSelector} was not found!`);
                return;
            }
            let startOffsetX, isDragging = false, animFrame = null;
            let prevX = 0, prevY = 0, targetX = 0, targetY = 0, startOffsetY = 0;
            let boundingRect = null;

            const tick = () => {
                if (isDragging) {
                    if (Math.abs(prevX - targetX) > 0.5 || Math.abs(prevY - targetY) > 0.5) {
                        prevX = targetX;
                        prevY = targetY;
                        windowEl.style.transform = `translate(${prevX}px, ${prevY}px)`;
                        windowEl.style.left  = '0px';
                        windowEl.style.top   = '0px';
                        windowEl.style.right = '';
                    }
                    animFrame = requestAnimationFrame(tick);
                }
            };

            const startDrag = (clientX, clientY) => {
                isDragging    = true;
                boundingRect  = windowEl.getBoundingClientRect();
                startOffsetX  = clientX - boundingRect.left;
                startOffsetY  = clientY - boundingRect.top;
                const transform = window.getComputedStyle(windowEl).transform;
                if (transform && transform !== 'none') {
                    const mat = new DOMMatrix(transform);
                    prevX = mat.m41;
                    prevY = mat.m42;
                } else {
                    prevX = boundingRect.left;
                    prevY = boundingRect.top;
                }
                targetX = prevX;
                targetY = prevY;
                document.body.style.userSelect = 'none';
                handleEl.classList.add('bm-dragging');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('touchmove', onTouchMove, { passive: false });
                document.addEventListener('mouseup',   stopDrag);
                document.addEventListener('touchend',  stopDrag);
                document.addEventListener('touchcancel', stopDrag);
                if (animFrame) cancelAnimationFrame(animFrame);
                tick();
            };

            const stopDrag = () => {
                isDragging = false;
                if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
                document.body.style.userSelect = '';
                handleEl.classList.remove('bm-dragging');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('mouseup',   stopDrag);
                document.removeEventListener('touchend',  stopDrag);
                document.removeEventListener('touchcancel', stopDrag);
            };

            const onMouseMove = e => {
                if (isDragging && boundingRect) { targetX = e.clientX - startOffsetX; targetY = e.clientY - startOffsetY; }
            };

            const onTouchMove = e => {
                if (isDragging && boundingRect) {
                    const touch = e.touches[0];
                    if (!touch) return;
                    targetX = touch.clientX - startOffsetX;
                    targetY = touch.clientY - startOffsetY;
                    e.preventDefault();
                }
            };

            handleEl.addEventListener('mousedown', e => { e.preventDefault(); startDrag(e.clientX, e.clientY); });
            handleEl.addEventListener('touchstart', e => {
                const touch = e?.touches?.[0];
                if (touch) { startDrag(touch.clientX, touch.clientY); e.preventDefault(); }
            }, { passive: false });
        }
    }

    class WindowWizard extends Overlay {
        constructor(name, version, requiredSchemaVersion, templateManager = undefined) {
            super(name, version);
            this.windowId              = 'bm-window-wizard';
            this.mountTarget           = document.body;
            this.storedData            = JSON.parse(GM_getValue('bmTemplates', '{}'));
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
            if (!document.querySelector('#bm-window-main')) extraStyle = 'z-index: 9001;';

            this.addDiv({ id: this.windowId, class: 'bm-window', style: extraStyle })
                .addTitleBar()
                    .addButton({ class: 'bm-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Template Wizard"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                        btn.onclick    = () => overlay.toggleMinimize(btn);
                        btn.ontouchend = () => btn.click();
                    }).up()
                    .addDiv().up()
                    .addButton({ class: 'bm-chrome-btn', textContent: '✖', 'aria-label': 'Close window "Template Wizard"' }, (overlay, btn) => {
                        btn.onclick    = () => document.querySelector(`#${this.windowId}`)?.remove();
                        btn.ontouchend = () => btn.click();
                    }).up()
                .up()
                .addDiv({ class: 'bm-content' })
                    .addDiv({ class: 'bm-col bm-spaced' })
                        .addHeading(1, { textContent: 'Template Wizard' }).up()
                    .up()
                    .addHr().up()
                    .addDiv({ class: 'bm-col' })
                        .addHeading(2, { textContent: 'Status' }).up()
                        .addParagraph({ id: 'bm-wizard-status', textContent: 'Loading template storage status...' }).up()
                    .up()
                    .addDiv({ class: 'bm-col bm-sections' })
                        .addHeading(2, { textContent: 'Detected templates:' }).up()
                    .up()
                .up()
            .mount(this.mountTarget);
            this.enableDragging(`#${this.windowId}.bm-window`, `#${this.windowId} .bm-titlebar`);
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

            this.setElementContent('bm-wizard-status', `${statusHTML}<br>Your templates were created during Yet Another Wplace Overlay version <b>${escapeHTML(this.scriptVersion)}</b> with schema version <b>${escapeHTML(this.schemaVersion)}</b>.<br>The current Yet Another Wplace Overlay version is <b>${escapeHTML(this.version)}</b> and requires schema version <b>${escapeHTML(this.requiredSchemaVersion)}</b>.<br>Wplace was last updated on <b>${wplaceVersionDate}</b>.${this.storageHealth !== 'Good' ? upgradeNotice : ''}`);

            const actionBuilder = new Overlay(this.name, this.version);
            if (this.storageHealth !== 'Dead') {
                actionBuilder.addDiv({ class: 'bm-col bm-row bm-spaced', style: 'gap: 1.5ch;' })
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
            actionBuilder.mount(document.querySelector('#bm-wizard-status').parentNode);
        }

        #buildTemplateList() {
            const templates = this.storedData?.templates;
            if (!templates || Object.keys(templates).length === 0) return;

            const sectionsEl  = document.querySelector(`#${this.windowId} .bm-sections`);
            const listBuilder = new Overlay(this.name, this.version);
            listBuilder.addDiv({ id: 'bm-wizard-list', class: 'bm-col' });

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

                listBuilder.addDiv({ class: 'bm-col bm-row' })
                    .addDiv({ class: 'bm-row', style: 'flex-direction: column; gap: 0;' })
                        .addDiv({ class: 'bm-template-thumb', textContent: '🖼️' }).up()
                        .addSmall({ textContent: `#${sortIdStr}` }).up()
                    .up()
                    .addDiv({ class: 'bm-row bm-template-info' })
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
                const contentEl = document.querySelector(`#${this.windowId} .bm-content`);
                contentEl.innerHTML = '';
                new Overlay(this.name, this.version)
                    .addDiv({ class: 'bm-col' })
                        .addDiv({ class: 'bm-col bm-spaced' })
                            .addHeading(1, { textContent: 'Template Wizard' }).up()
                        .up()
                        .addHr().up()
                        .addDiv({ class: 'bm-col' })
                            .addHeading(2, { textContent: 'Status' }).up()
                            .addParagraph({ textContent: 'Updating template storage. Please wait...' }).up()
                        .up()
                    .up()
                .mount(contentEl);
            }
            GM_deleteValue('bmCoords');
            const templates = this.storedData?.templates;
            if (templates && Object.keys(templates).length > 0) {
                for (const [, entry] of Object.entries(templates)) {
                    if (!templates.hasOwnProperty(entry)) {
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

    class TemplateManager {
        constructor(name, version) {
            this.name            = name;
            this.version         = version;
            this.windowMain      = null;
            this.settingsManager = null;
            this.schemaVersion   = '2.0.0';
            this.userId          = null;
            this.encodeAlphabet  = "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~";
            this.tileSize        = 1000;
            this.pixelsPerTile   = 3;
            this.paletteTolerance = 3;
            this.paletteCache    = this.#buildPaletteCache(this.paletteTolerance);
            this.storageData     = null;
            this.templates       = [];
            this.isEnabled       = true;
            this.hiddenColors    = new Map();
            // Flags d'état pour le solo mode et le highlight
            this._soloMode = false;
            this._soloObs  = null;
            this._hlActive = false;
        }

        setWindowMain(windowMain)        { this.windowMain      = windowMain; }
        setSettingsManager(settingsManager) { this.settingsManager = settingsManager; }

        async createTemplate(file, displayName, coords) {
            if (!this.storageData) this.storageData = await this.#createEmptyStorage();
            this.windowMain.setStatus(`Creating template at ${coords.join(', ')}...`);

            const tmpl = new Template({
                displayName,
                sortId:   0,
                authorId: encodeBase(this.userId || 0, this.encodeAlphabet),
                file,
                coords
            });
            const skipTransparent = !this.settingsManager?.settings?.flags?.includes('hl-noSkip');
            const aggressiveSkip  = !!this.settingsManager?.settings?.flags?.includes('hl-agSkip');
            const { imageBitmaps, base64Tiles } = await tmpl.processImage(this.tileSize, this.paletteCache, skipTransparent, aggressiveSkip);
            tmpl.tiles = imageBitmaps;

            const pixelStatsForStorage = {
                total:  tmpl.pixelStats.total,
                colors: Object.fromEntries(tmpl.pixelStats.colors)
            };
            this.storageData.templates[`${tmpl.sortId} ${tmpl.authorId}`] = {
                name:    tmpl.displayName,
                coords:  coords.join(', '),
                enabled: true,
                pixels:  pixelStatsForStorage,
                tiles:   base64Tiles
            };
            this.templates = [];
            this.templates.push(tmpl);
            this.windowMain.setStatus(`Template created at ${coords.join(', ')}!`);
            await this.#saveToStorage();
        }

        async downloadAllTemplates() {
            consoleLog('Downloading all templates...');
            for (const tmpl of this.templates) {
                await this.#downloadTemplate(tmpl);
                await sleep(500);
            }
        }

        async loadFromStorage() {
            const stored = JSON.parse(GM_getValue('bmTemplates', '{}')).templates;
            if (!stored || Object.keys(stored).length === 0) return;
            for (const [key, entry] of Object.entries(stored)) {
                if (!stored.hasOwnProperty(key)) continue;
                await this.#downloadTemplate(new Template({ displayName: entry.name, sortId: key.split(' ')?.[0], tiles: entry.tiles }));
                await sleep(500);
            }
        }

        async compositeTemplateTiles(tmpl) {
            const tileKeys  = Object.keys(tmpl.tiles).sort();
            const images    = await Promise.all(tileKeys.map(key => {
                const src = tmpl.tiles[key];
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload  = () => resolve(img);
                    img.onerror = reject;
                    img.src     = 'data:image/png;base64,' + src;
                });
            }));
            let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
            tileKeys.forEach((key, idx) => {
                const [tileX, tileY, pixelX, pixelY] = key.split(',').map(Number);
                const img = images[idx];
                const absX = tileX * this.tileSize + pixelX;
                const absY = tileY * this.tileSize + pixelY;
                minX = Math.min(minX, absX);
                minY = Math.min(minY, absY);
                maxX = Math.max(maxX, absX + img.width  / this.pixelsPerTile);
                maxY = Math.max(maxY, absY + img.height / this.pixelsPerTile);
            });
            const logicalW  = maxX - minX;
            const logicalH  = maxY - minY;
            const scaledW   = logicalW * this.pixelsPerTile;
            const scaledH   = logicalH * this.pixelsPerTile;
            const bigCanvas = new OffscreenCanvas(scaledW, scaledH);
            const bigCtx    = bigCanvas.getContext('2d');
            tileKeys.forEach((key, idx) => {
                const [tileX, tileY, pixelX, pixelY] = key.split(',').map(Number);
                const img  = images[idx];
                const absX = tileX * this.tileSize + pixelX;
                const absY = tileY * this.tileSize + pixelY;
                bigCtx.drawImage(img, (absX - minX) * this.pixelsPerTile, (absY - minY) * this.pixelsPerTile, img.width, img.height);
            });
            bigCtx.globalCompositeOperation = 'destination-over';
            bigCtx.drawImage(bigCanvas, 0, -1);
            bigCtx.drawImage(bigCanvas, 0,  1);
            bigCtx.drawImage(bigCanvas, -1, 0);
            bigCtx.drawImage(bigCanvas,  1, 0);
            const outCanvas = new OffscreenCanvas(logicalW, logicalH);
            const outCtx    = outCanvas.getContext('2d');
            outCtx.imageSmoothingEnabled = false;
            outCtx.drawImage(bigCanvas, 0, 0, scaledW, scaledH, 0, 0, logicalW, logicalH);
            return outCanvas.convertToBlob({ type: 'image/png' });
        }

        async renderTileOverlay(tileBlob, tileCoords) {
            if (!this.isEnabled) return tileBlob;
            const scaledSize = this.tileSize * this.pixelsPerTile;
            const coordKey   = tileCoords[0].toString().padStart(4, '0') + ',' + tileCoords[1].toString().padStart(4, '0');
            const sorted     = [...this.templates].sort((a, b) => a.sortId - b.sortId);
            const matching   = sorted.map(tmpl => {
                const keys = Object.keys(tmpl.tiles).filter(k => k.startsWith(coordKey));
                if (keys.length === 0) return null;
                const key  = keys[0];
                const parts = key.split(',');
                return {
                    template:   tmpl,
                    tileBitmap: tmpl.tiles[key],
                    pixelData:  tmpl.pixelData?.[key],
                    tileCoordStr:  [parts[0], parts[1]],
                    pixelOffset:   [parts[2], parts[3]]
                };
            }).filter(Boolean);

            if (matching.length === 0) {
                this.windowMain.setStatus(`Sleeping\nVersion: ${this.version}`);
                return tileBlob;
            }

            const visibleCount = sorted.filter(t => Object.keys(t.tiles).some(k => k.startsWith(coordKey))).length;
            const totalPx      = formatNumber(sorted.filter(t => Object.keys(t.tiles).some(k => k.startsWith(coordKey))).reduce((acc, t) => acc + (t.pixelStats.total || 0), 0));
            this.windowMain.setStatus(`Displaying ${visibleCount} template${visibleCount === 1 ? '' : 's'}.\nTotal pixels: ${totalPx}`);

            const liveBitmap = await createImageBitmap(tileBlob);
            const canvas     = new OffscreenCanvas(scaledSize, scaledSize);
            const ctx        = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.beginPath(); ctx.rect(0, 0, scaledSize, scaledSize); ctx.clip();
            ctx.clearRect(0, 0, scaledSize, scaledSize);
            ctx.drawImage(liveBitmap, 0, 0, scaledSize, scaledSize);

            const liveImageData = ctx.getImageData(0, 0, scaledSize, scaledSize);
            const livePixels    = new Uint32Array(liveImageData.data.buffer);
            const highlight     = this.settingsManager?.settings?.highlight ?? [[2, 0, 0]];
            const isDefaultHl   = highlight?.length === 1 && highlight[0][0] === 2 && highlight[0][1] === 0 && highlight[0][2] === 0;

            for (const entry of matching) {
                const hasErased   = !!entry.template.pixelStats?.colors?.get(-1);
                let templatePixels = entry.pixelData?.slice();
                const offsetX = Number(entry.pixelOffset[0]) * this.pixelsPerTile;
                const offsetY = Number(entry.pixelOffset[1]) * this.pixelsPerTile;

                if (this.hiddenColors.size === 0 && !hasErased)
                    ctx.drawImage(entry.tileBitmap, offsetX, offsetY);

                if (!templatePixels) {
                    const img = ctx.getImageData(offsetX, offsetY, entry.tileBitmap.width, entry.tileBitmap.height);
                    templatePixels = new Uint32Array(img.data.buffer);
                }

                const { correctMap, outputPixels } = this.#computePixelDiff({
                    livePixels, templatePixels,
                    region:       [offsetX, offsetY, entry.tileBitmap.width, entry.tileBitmap.height],
                    highlight, isDefaultHighlight: isDefaultHl
                });

                if (this.hiddenColors.size !== 0 || hasErased || !isDefaultHl)
                    ctx.drawImage(await createImageBitmap(new ImageData(new Uint8ClampedArray(outputPixels.buffer), entry.tileBitmap.width, entry.tileBitmap.height)), offsetX, offsetY);

                if (entry.template.pixelStats.correct === undefined) entry.template.pixelStats.correct = {};
                entry.template.pixelStats.correct[coordKey] = correctMap;
            }
            return canvas.convertToBlob({ type: 'image/png' });
        }

        importFromStorage(data) {
            if (data?.whoami === 'BlueMarble') this.#importTemplates(data);
        }

        setEnabled(enabled) { this.isEnabled = enabled; }

        // ── Méthodes privées ──────────────────────────────────────

        #buildPaletteCache(tolerance) {
            const palette = [...COLOR_PALETTE];
            palette.unshift({ id: -1, premium: false, name: 'Erased', rgb: [222, 250, 206] });
            palette.unshift({ id: -2, premium: false, name: 'Other',  rgb: [0, 0, 0] });
            const colorLookup = new Map();
            for (const color of palette) {
                if (color.id === 0 || color.id === -2) continue;
                const [r, g, b] = color.rgb;
                for (let dr = -tolerance; dr <= tolerance; dr++)
                    for (let dg = -tolerance; dg <= tolerance; dg++)
                        for (let db = -tolerance; db <= tolerance; db++) {
                            const nr = r + dr, ng = g + dg, nb = b + db;
                            if (nr < 0 || nr > 255 || ng < 0 || ng > 255 || nb < 0 || nb > 255) continue;
                            const packed = (255 << 24 | nb << 16 | ng << 8 | nr) >>> 0;
                            if (!colorLookup.has(packed)) colorLookup.set(packed, color.id);
                        }
            }
            return { palette, jt: colorLookup };
        }

        async #createEmptyStorage() {
            return {
                whoami:        this.name.replace(' ', ''),
                scriptVersion: this.version,
                schemaVersion: this.schemaVersion,
                templates:     {}
            };
        }

        async #ensureStorage() {
            if (!this.storageData) this.storageData = await this.#createEmptyStorage();
        }

        async #downloadTemplate(tmpl) {
            tmpl.inferCoordsFromTiles();
            const filename = `${tmpl.coords.join('-')}_${tmpl.displayName.replaceAll(' ', '-')}`;
            const blob     = await this.compositeTemplateTiles(tmpl);
            await GM.download({
                url:     URL.createObjectURL(blob),
                name:    filename + '.png',
                saveAs:  'uniquify',
                onload:  () => consoleLog(`Download of template '${filename}' complete!`),
                onerror: (err, details) => consoleError(`Download of template '${filename}' failed because ${err}! Details: ${details}`),
                ontimeout: () => consoleWarn(`Download of template '${filename}' has timed out!`)
            });
        }

        async #saveToStorage() {
            GM.setValue('bmTemplates', JSON.stringify(this.storageData));
        }

        async #importTemplates(data) {
            const entries      = data.templates;
            const storedVer    = data?.schemaVersion?.split(/[-\.+]/) ?? [];
            const currentVer   = this.schemaVersion.split(/[-\.+]/);
            const scriptVer    = data?.scriptVersion;

            if (storedVer[0] === currentVer[0]) {
                if (storedVer[1] !== currentVer[1])
                    new WindowWizard(this.name, this.version, this.schemaVersion, this).toggle();

                this.templates = await (async ({ tileSize, pixelsPerTile, templates }) => {
                    const loaded = [];
                    if (Object.keys(entries).length > 0) {
                        for (const key in entries) {
                            if (!entries.hasOwnProperty(key)) continue;
                            const entry    = entries[key];
                            const parts    = key.split(' ');
                            const sortId   = Number(parts?.[0]);
                            const authorId = parts?.[1] || '0';
                            const name     = entry.name || `Template ${sortId || ''}`;
                            const pixelStats = {
                                total:  entry.pixels?.total,
                                colors: new Map(Object.entries(entry.pixels?.colors || {}).map(([k, v]) => [Number(k), v]))
                            };
                            const base64Tiles = entry.tiles;
                            const imageBitmaps = {};
                            const pixelDataMap = {};
                            const canvasSize   = tileSize * pixelsPerTile;
                            for (const tileKey in base64Tiles) {
                                if (!base64Tiles.hasOwnProperty(tileKey)) continue;
                                const bytes    = base64ToUint8(base64Tiles[tileKey]);
                                const imgBitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
                                imageBitmaps[tileKey] = imgBitmap;
                                const tmpCanvas = new OffscreenCanvas(canvasSize, canvasSize);
                                const tmpCtx    = tmpCanvas.getContext('2d');
                                tmpCtx.drawImage(imgBitmap, 0, 0);
                                const imgData = tmpCtx.getImageData(0, 0, imgBitmap.width, imgBitmap.height);
                                pixelDataMap[tileKey] = new Uint32Array(imgData.data.buffer);
                            }
                            const tmpl = new Template({ displayName: name, sortId: sortId || loaded.length || 0, authorId: authorId });
                            tmpl.pixelStats = pixelStats;
                            tmpl.tiles      = imageBitmaps;
                            tmpl.pixelData  = pixelDataMap;
                            loaded.push(tmpl);
                        }
                    }
                    return loaded;
                })({ tileSize: this.tileSize, pixelsPerTile: this.pixelsPerTile, templates: entries });
            } else if (storedVer[0] < currentVer[0]) {
                new WindowWizard(this.name, this.version, this.schemaVersion, this).toggle();
            } else {
                this.windowMain.setError(`Template version ${data?.schemaVersion} is unsupported.\nUse Yet Another Wplace Overlay version ${scriptVer} or load a new template.`);
            }
        }

        #computePixelDiff({ livePixels, templatePixels, region, highlight, isDefaultHighlight }) {
            const scale       = this.pixelsPerTile;
            const canvasSize  = this.tileSize * scale;
            const [offsetX, offsetY, regionW, regionH] = region;
            const tolerance   = this.paletteTolerance;
            const showTransp  = !this.settingsManager?.settings?.flags?.includes('hl-noTrans');
            const { jt: colorLookup } = this.paletteCache;
            const correctMap  = new Map();

            for (let row = 1; row < regionH; row += scale) {
                for (let col = 1; col < regionW; col += scale) {
                    const liveY    = offsetY + row - 1;
                    const liveX    = offsetX + col;
                    const livePx   = livePixels[liveY * canvasSize + liveX];
                    const tmplPx   = templatePixels[row * regionW + col];
                    const tmplA    = tmplPx >>> 24 & 255;
                    const liveA    = livePx >>> 24 & 255;
                    const tmplColor = colorLookup.get(tmplPx) ?? -2;
                    const liveColor = colorLookup.get(livePx) ?? -2;

                    // Couleur cachée : remplacer par le pixel live
                    if (this.hiddenColors.get(tmplColor))
                        templatePixels[row * regionW + col] = livePx;

                    // Pixel effacé (transparent) : pattern damier
                    if (tmplColor === -1) {
                        const ALPHA_GRAY = 536870912;
                        if (this.hiddenColors.get(tmplColor)) {
                            templatePixels[row * regionW + col] = 0;
                        } else if ((liveY / scale & 1) === (liveX / scale & 1)) {
                            templatePixels[row * regionW + col]                              = ALPHA_GRAY;
                            templatePixels[(row - 1) * regionW + (col - 1)]                 = ALPHA_GRAY;
                            templatePixels[(row - 1) * regionW + (col + 1)]                 = ALPHA_GRAY;
                            templatePixels[(row + 1) * regionW + (col - 1)]                 = ALPHA_GRAY;
                            templatePixels[(row + 1) * regionW + (col + 1)]                 = ALPHA_GRAY;
                        } else {
                            templatePixels[row * regionW + col]                = 0;
                            templatePixels[(row - 1) * regionW + col]          = ALPHA_GRAY;
                            templatePixels[(row + 1) * regionW + col]          = ALPHA_GRAY;
                            templatePixels[row * regionW + (col - 1)]          = ALPHA_GRAY;
                            templatePixels[row * regionW + (col + 1)]          = ALPHA_GRAY;
                        }
                    }

                    // Highlight des pixels incorrects
                    if (!isDefaultHighlight && tmplA > tolerance && liveColor !== tmplColor && (showTransp || liveA > tolerance)) {
                        const currentPx = templatePixels[row * regionW + col];
                        for (const [mode, dx, dy] of highlight) {
                            const fillPx = mode !== 0 ? (mode !== 1 ? currentPx : 0xFF0000FF) : 0;
                            templatePixels[(row + dy) * regionW + (col + dx)] = fillPx;
                        }
                    }

                    // Comptage des pixels corrects
                    if (tmplColor === -1 && livePx <= tolerance) {
                        correctMap.set(tmplColor, (correctMap.get(tmplColor) ?? 0) + 1);
                        continue;
                    }
                    if (tmplA <= tolerance || liveA <= tolerance) continue;
                    if (liveColor !== tmplColor) continue;
                    correctMap.set(tmplColor, (correctMap.get(tmplColor) ?? 0) + 1);
                }
            }
            return { correctMap, outputPixels: templatePixels };
        }
    }

    class ApiManager {
        constructor(templateManager) {
            this.templateManager = templateManager;
            this.robotsBlocked   = false;
            this.chargesTimerId  = '';
            this.lastClickCoords = [];
        }

        startListening(windowMain) {
            window.addEventListener('message', async event => {
                const { source, jsonData, endpoint, blobID, blobData, blink } = event.data;
                if (!event.data || source !== 'yaw-overlay') return;
                if (!endpoint) return;

                const routeSegment = endpoint.split('?')[0]
                    .split('/')
                    .filter(s => s && isNaN(Number(s)))
                    .filter(s => !s.includes('.'))
                    .pop();

                switch (routeSegment) {
                    case 'me': {
                        if (jsonData.status && jsonData.status.toString()[0] !== '2') {
                            windowMain.setError('You are not logged in or Wplace is offline!\nCould not fetch userdata.');
                            return;
                        }
                        const pixelsToNextLevel = Math.ceil(Math.pow(Math.floor(jsonData.level) * Math.pow(30, 0.65), 1 / 0.65) - jsonData.pixelsPainted);
                        this.templateManager.userId = jsonData.id;
                        if (this.chargesTimerId.length > 0) {
                            const timerEl = document.querySelector('#' + this.chargesTimerId);
                            if (timerEl) {
                                const charges = jsonData.charges;
                                timerEl.dataset.endDate = Date.now() + (charges.max - charges.count) * charges.cooldownMs;
                            }
                        }
                        windowMain.setElementContent('bm-droplets',   `Droplets: <b>${formatNumber(jsonData.droplets)}</b>`);
                        windowMain.setElementContent('bm-next-level',  `Next level in <b>${formatNumber(pixelsToNextLevel)}</b> pixel${pixelsToNextLevel === 1 ? '' : 's'}`);
                        break;
                    }
                    case 'pixel': {
                        const tileSegments  = endpoint.split('?')[0].split('/').filter(s => s && !isNaN(Number(s)));
                        const queryParams    = new URLSearchParams(endpoint.split('?')[1]);
                        const pixelCoords   = [queryParams.get('x'), queryParams.get('y')];
                        if (this.lastClickCoords.length && (!tileSegments.length || !pixelCoords.length)) {
                            windowMain.setError('Coordinates are malformed!\nDid you try clicking the canvas first?');
                            return;
                        }
                        this.lastClickCoords = [...tileSegments, ...pixelCoords];
                        const displayCoords = [
                            parseInt(tileSegments[0]) % 4 * 1000 + parseInt(pixelCoords[0]),
                            parseInt(tileSegments[1]) % 4 * 1000 + parseInt(pixelCoords[1])
                        ];
                        const spanEls = document.querySelectorAll('span');
                        for (const span of spanEls) {
                            const text = span.textContent.trim();
                            if (text.includes(displayCoords[0]) && text.includes(displayCoords[1])) {
                                let coordsDisplay = document.querySelector('#bm-coords-display');
                                const labels   = ['Tl X:', 'Tl Y:', 'Px X:', 'Px Y:'];
                                const ids      = ['bm-coords-tile-x', 'bm-coords-tile-y', 'bm-coords-pixel-x', 'bm-coords-pixel-y'];
                                const allCoords = [...tileSegments, ...pixelCoords];
                                if (coordsDisplay) {
                                    for (const [idx, id] of ids.entries())
                                        document.getElementById(id).textContent = `${labels[idx] ?? '??:'} ${allCoords[idx]}`;
                                } else {
                                    coordsDisplay = document.createElement('span');
                                    coordsDisplay.id = 'bm-coords-display';
                                    coordsDisplay.style = 'display: flex; flex-wrap: wrap; gap: 0 1ch; font-size: small;';
                                    for (const [idx, coord] of allCoords.entries()) {
                                        const part = document.createElement('span');
                                        part.id = ids[allCoords.indexOf(coord) ?? ''];
                                        part.textContent = `${labels[idx] ?? '??:'} ${coord}`;
                                        coordsDisplay.appendChild(part);
                                    }
                                    span.parentNode.parentNode.parentNode.insertAdjacentElement('afterend', coordsDisplay);
                                }
                            }
                        }
                        break;
                    }
                    case 'tile':
                    case 'tiles': {
                        let parts = endpoint.split('/');
                        const tileCoords = [
                            parseInt(parts[parts.length - 2]),
                            parseInt(parts[parts.length - 1].replace('.png', ''))
                        ];
                        const processedBlob = await this.templateManager.renderTileOverlay(blobData, tileCoords);
                        window.postMessage({
                            source:   'yaw-overlay',
                            blobID,
                            blobData: processedBlob,
                            blink
                        });
                        break;
                    }
                    case 'robots':
                        this.robotsBlocked = jsonData.userscript?.toString().toLowerCase() === 'false';
                        break;
                }
            });
        }
    }

    class WindowSettings extends Overlay {
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
                        this.buildPixelHighlightSection();
                        this.buildTemplateSection();
                    }).up()
                .up()
            .mount(this.mountTarget);
            this.enableDragging(`#${this.windowId}.bm-window`, `#${this.windowId} .bm-titlebar`);
        }

        buildPixelHighlightSection() {
            this.#buildPlaceholderSection('Pixel Highlight');
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

    class SettingsManager extends WindowSettings {
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

    class ConfettiManager {
        constructor() {
            this.pieceCount = Math.ceil(80 / 1300 * window.innerWidth);
            this.colors     = COLOR_PALETTE.slice(1);
        }

        launch(targetEl) {
            const container = document.createElement('div');
            for (let i = 0; i < this.pieceCount; i++) {
                const piece = document.createElement('confetti-piece');
                piece.style.setProperty('--x',        100 * Math.random() + 'vw');
                piece.style.setProperty('--delay',    2 * Math.random() + 's');
                piece.style.setProperty('--duration', 3 + 3 * Math.random() + 's');
                piece.style.setProperty('--rot',      360 * Math.random() + 'deg');
                piece.style.setProperty('--size',     6 + 6 * Math.random() + 'px');
                piece.style.backgroundColor = `rgb(${this.colors[Math.floor(Math.random() * this.colors.length)].rgb.join(',')})`;
                piece.onanimationend = () => {
                    piece.parentNode.childElementCount <= 1 ? piece.parentNode.remove() : piece.remove();
                };
                container.appendChild(piece);
            }
            targetEl.appendChild(container);
        }
    }

    class ConfettiPiece extends HTMLElement {}
    customElements.define('confetti-piece', ConfettiPiece);

    class WindowColorFilter extends Overlay {
        constructor(ctx) {
            super(ctx.name, ctx.version);
            this.windowId        = 'bm-window-filter';
            this.listContainerId = 'bm-filter-list';
            this.mountTarget     = document.body;
            this.templateManager = ctx.apiManager?.templateManager ?? ctx;

            const { palette } = this.templateManager.paletteCache;
            this.palette        = palette;
            this.tilesChecked   = 0;
            this.totalTiles     = 0;
            this.totalByColor   = new Map();
            this.correctByColor = new Map();
            this.correctTotal   = 0;
            this.pixelsTotal    = 0;
            this.timeRemaining  = 0;
            this.formattedEta   = '';
            this.sortPrimary    = 'id';
            this.sortSecondary  = 'ascending';
            this.showUnused     = false;

            this.#eyeShownSvg  = '<svg viewBox="0 0 .5 6 3"><path d="M0,2Q3-1 6,2Q3,5 0,2H2A1,1 0 1 0 3,1Q3,2 2,2"/></svg>';
            this.#eyeHiddenSvg = '<svg viewBox="0 1 12 6"><mask id="a"><path d="M0,0H12V8L0,2" fill="#fff"/></mask><path d="M0,4Q6-2 12,4Q6,10 0,4H4A2,2 0 1 0 6,2Q6,4 4,4ZM1,2L10,6.5L9.5,7L.5,2.5" mask="url(#a)"/></svg>';
        }

        #eyeShownSvg  = '';
        #eyeHiddenSvg = '';

        toggle() {
            const existing = document.querySelector('#bm-color-dropdown');
            if (existing) { existing._posObs?.disconnect(); existing.remove(); return; }

            const anchor = document.querySelector('[data-bm-filter="1"]');
            if (!anchor) return;

            const { palette: pal } = this.templateManager.paletteCache;

            // Ordre du jeu : lit la position des éléments #color-N dans le DOM de la palette
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
            for (const tmpl of this.templateManager.templates) {
                totalPixels += tmpl.pixelStats?.total ?? 0;
                const colors = tmpl.pixelStats?.colors ?? new Map();
                for (const [cid, cnt] of colors) ieMap.set(cid, (ieMap.get(cid) ?? 0) + Number(cnt));
                const corr = tmpl.pixelStats?.correct ?? {};
                for (const tileCorr of Object.values(corr))
                    for (const [cid, cnt] of tileCorr) neMap.set(cid, (neMap.get(cid) ?? 0) + Number(cnt));
            }

            const wrap = document.createElement('div');
            wrap.id = 'bm-color-dropdown';
            wrap.style.cssText = `
            position:fixed; z-index:9999;
            background:var(--color-bg,#1a1a1a);
            border:1px solid rgba(255,255,255,.12);
            border-radius:8px; width:380px;
            box-shadow:0 8px 24px rgba(0,0,0,.4);
            font-family:inherit; font-size:13px; overflow:hidden;
        `;

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

            const applySolo = colorId => {
                if (colorId === null) return;
                for (const c of pal) { if (c.id > 0) this.templateManager.hiddenColors.set(c.id, true); }
                this.templateManager.hiddenColors.delete(colorId);
                document.querySelectorAll('#bm-color-dropdown [data-color-id]').forEach(row => {
                    const rid  = parseInt(row.dataset.colorId, 10);
                    const eye  = row.querySelector('.bm-eye-toggle');
                    const shown = rid === colorId;
                    if (eye) { eye.dataset.state = shown ? 'shown' : 'hidden'; eye.style.opacity = shown ? '0.72' : '0.28'; }
                    row.style.opacity = shown ? '1' : '0.38';
                });
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

            // ── Header ────────────────────────────────────────────
            const header = document.createElement('div');
            header.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid rgba(255,255,255,.1);`;

            const titleEl = document.createElement('span');
            titleEl.style.cssText = `font-weight:600; color:rgba(255,255,255,.9); font-size:13px;`;
            const shownCount = sortedPal.filter(p => p.id > 0 && (ieMap.get(p.id) ?? 0) > 0).length;
            titleEl.textContent = `Couleurs (${shownCount})`;

            const mkBtn = (label, bg, fg, onclick) => {
                const btn = document.createElement('button');
                btn.textContent = label;
                btn.style.cssText = `background:${bg}; border:1px solid ${fg}44; color:${fg}; border-radius:5px; padding:3px 6px; font-size:11px; cursor:pointer; transition:background .12s;`;
                btn.onmouseenter = () => { btn.style.background = bg.replace(/[\d.]+\)$/, m => (parseFloat(m) * 2.5) + ')') || bg; };
                btn.onmouseleave = () => { btn.style.background = bg; };
                btn.onclick = onclick;
                return btn;
            };

            // Bouton Solo
            const soloOnBg  = 'rgba(251,191,36,.25)', soloOnFg  = 'rgba(251,191,36,1)';
            const soloOffBg = 'rgba(255,255,255,.08)', soloOffFg = 'rgba(255,255,255,.6)';
            const soloBtn = document.createElement('button');
            soloBtn.title = 'Afficher uniquement la couleur sélectionnée sur Wplace';
            const refreshSoloBtnStyle = () => {
                const on = this.templateManager._soloMode;
                soloBtn.textContent = '◎ Solo';
                soloBtn.style.cssText = `background:${on ? soloOnBg : soloOffBg}; border:1px solid ${on ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.15)'}; color:${on ? soloOnFg : soloOffFg}; border-radius:5px; padding:3px 6px; font-size:11px; cursor:pointer; transition:all .12s; font-weight:${on ? '600' : '400'};`;
            };
            refreshSoloBtnStyle();
            soloBtn.onclick = () => {
                this.templateManager._soloMode = !this.templateManager._soloMode;
                refreshSoloBtnStyle();
                if (this.templateManager._soloMode) {
                    startSoloObs();
                } else {
                    stopSoloObs();
                    this.templateManager.hiddenColors.clear();
                    document.querySelectorAll('#bm-color-dropdown [data-color-id]').forEach(row => {
                        const eye = row.querySelector('.bm-eye-toggle');
                        if (eye) { eye.dataset.state = 'shown'; eye.style.opacity = '0.72'; }
                        row.style.opacity = '1';
                    });
                }
            };

            // Bouton Highlight
            const hlOnBg  = 'rgba(251,191,36,.25)', hlOnFg  = 'rgba(251,191,36,1)';
            const hlOffBg = 'rgba(255,255,255,.08)', hlOffFg = 'rgba(255,255,255,.5)';
            const hlBtn = document.createElement('button');
            hlBtn.title = 'Surligner le pixel incorrect le plus proche du curseur';
            const refreshHlBtnStyle = () => {
                const on = this.templateManager._hlActive;
                hlBtn.textContent = '🎯';
                hlBtn.style.cssText = `background:${on ? hlOnBg : hlOffBg}; border:1px solid ${on ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.15)'}; color:${on ? hlOnFg : hlOffFg}; border-radius:5px; padding:3px 6px; font-size:11px; cursor:pointer; transition:all .12s; box-shadow:${on ? '0 0 6px rgba(251,191,36,.3)' : 'none'};`;
            };
            refreshHlBtnStyle();
            hlBtn.onclick = () => {
                this.templateManager._hlActive = !this.templateManager._hlActive;
                refreshHlBtnStyle();
            };

            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = `display:flex; gap:4px; align-items:center;`;
            btnGroup.appendChild(hlBtn);
            btnGroup.appendChild(soloBtn);
            btnGroup.appendChild(mkBtn('✓ All',  'rgba(74,222,128,.15)',  'rgba(74,222,128,.9)',  () => { this.templateManager.hiddenColors.clear(); wrap.remove(); this.toggle(); }));
            btnGroup.appendChild(mkBtn('✗ None', 'rgba(248,113,113,.15)', 'rgba(248,113,113,.9)', () => { for (const c of pal) { if (c.id > 0) this.templateManager.hiddenColors.set(c.id, true); } wrap.remove(); this.toggle(); }));
            btnGroup.appendChild(mkBtn('↻',      'rgba(255,255,255,.08)', 'rgba(255,255,255,.7)', () => { wrap.remove(); this.toggle(); }));

            header.appendChild(titleEl);
            header.appendChild(btnGroup);
            wrap.appendChild(header);

            // ── Liste scrollable ──────────────────────────────────
            const list = document.createElement('div');
            list.style.cssText = `max-height:340px; overflow-y:auto; padding:4px 0;`;

            for (const color of sortedPal) {
                if (color.id <= 0) continue;
                const total   = ieMap.get(color.id) ?? 0;
                if (total === 0) continue;
                const correct = neMap.get(color.id) ?? 0;
                const pct     = total > 0 ? Math.round(correct / total * 100) : 0;
                const [r, g, b] = color.rgb;
                const isHidden  = !!this.templateManager.hiddenColors.get(color.id);

                const row = document.createElement('div');
                row.dataset.colorId = color.id;
                row.style.cssText = `display:flex; align-items:center; gap:8px; padding:5px 10px; opacity:${isHidden ? '0.4' : '1'}; transition:opacity .15s;`;
                row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,.05)'; };
                row.onmouseleave = () => { row.style.background = ''; };

                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'bm-eye-toggle';
                toggleBtn.dataset.state = isHidden ? 'hidden' : 'shown';
                toggleBtn.title = isHidden ? `Afficher ${color.name} sur l'overlay` : `Masquer ${color.name} de l'overlay`;
                toggleBtn.style.cssText = `background:none; border:none; cursor:pointer; padding:0; font-size:13px; flex-shrink:0; line-height:1; opacity:${isHidden ? '0.3' : '0.8'}; transition:opacity .15s;`;
                toggleBtn.textContent = '👁';
                toggleBtn.onclick = ev => {
                    ev.stopPropagation();
                    if (toggleBtn.dataset.state === 'shown') {
                        this.templateManager.hiddenColors.set(color.id, true);
                        toggleBtn.dataset.state  = 'hidden';
                        toggleBtn.style.opacity  = '0.3';
                        toggleBtn.title          = `Afficher ${color.name} sur l'overlay`;
                        row.style.opacity        = '0.4';
                    } else {
                        this.templateManager.hiddenColors.delete(color.id);
                        toggleBtn.dataset.state  = 'shown';
                        toggleBtn.style.opacity  = '0.8';
                        toggleBtn.title          = `Masquer ${color.name} de l'overlay`;
                        row.style.opacity        = '1';
                    }
                };

                const swatch = document.createElement('div');
                swatch.style.cssText = `width:14px; height:14px; flex-shrink:0; border-radius:3px; background:rgb(${r},${g},${b}); border:1px solid rgba(255,255,255,.15);`;

                const nameEl = document.createElement('span');
                nameEl.style.cssText = `flex:1; color:rgba(255,255,255,.85);`;
                nameEl.textContent = color.name;

                const barWrap = document.createElement('div');
                barWrap.style.cssText = `width:48px; height:4px; background:rgba(255,255,255,.1); border-radius:2px; flex-shrink:0;`;
                const bar = document.createElement('div');
                const barColor = pct >= 80 ? '#4ade80' : pct >= 40 ? '#facc15' : '#f87171';
                bar.style.cssText = `height:100%; border-radius:2px; background:${barColor}; width:${pct}%;`;
                barWrap.appendChild(bar);

                const statsEl = document.createElement('span');
                statsEl.style.cssText = `color:rgba(255,255,255,.5); font-size:11px; white-space:nowrap; width:150px; flex-shrink:0; text-align:right;`;
                statsEl.textContent = `${correct}/${total} (${pct}%)`;

                row.appendChild(toggleBtn);
                row.appendChild(swatch);
                row.appendChild(nameEl);
                row.appendChild(barWrap);
                row.appendChild(statsEl);
                list.appendChild(row);
            }
            wrap.appendChild(list);
            document.body.appendChild(wrap);

            // Positionnement sous le bouton anchor
            const reposition = () => {
                const rect = anchor.getBoundingClientRect();
                wrap.style.top  = (rect.bottom + 4) + 'px';
                wrap.style.left = rect.left + 'px';
            };
            reposition();

            const bmWin = anchor.closest('.bm-window');
            if (bmWin) {
                const posObs = new MutationObserver(reposition);
                posObs.observe(bmWin, { attributes: true, attributeFilter: ['style'] });
                wrap._posObs = posObs;
            }
        }

        toggleCompact() {
            if (document.querySelector(`#${this.windowId}`)) {
                document.querySelector(`#${this.windowId}`).remove();
                return;
            }
            this.addDiv({ id: this.windowId, class: 'bm-window bm-compact' })
                .addTitleBar()
                    .addButton({ class: 'bm-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Color Filter"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                        btn.onclick = () => {
                            const statsEl = document.querySelector('#bm-compact-stats');
                            if (statsEl) statsEl.style.display = btn.dataset.buttonStatus === 'expanded' ? 'none' : '';
                            overlay.toggleMinimize(btn);
                        };
                        btn.ontouchend = () => btn.click();
                    }).up()
                    .addDiv()
                        .addSpan({ id: 'bm-compact-stats', class: 'bm-text-bold' }).up()
                    .up()
                    .addDiv({ class: 'bm-row' })
                        .addButton({ class: 'bm-chrome-btn', textContent: '🗖', 'aria-label': 'Switch to fullscreen mode for "Color Filter"' }, (overlay, btn) => {
                            btn.onclick    = () => { document.querySelector(`#${this.windowId}`)?.remove(); this.toggle(); };
                            btn.ontouchend = () => btn.click();
                        }).up()
                        .addButton({ class: 'bm-chrome-btn', textContent: '✖', 'aria-label': 'Close window "Color Filter"' }, (overlay, btn) => {
                            btn.onclick    = () => document.querySelector(`#${this.windowId}`)?.remove();
                            btn.ontouchend = () => btn.click();
                        }).up()
                    .up()
                .up()
                .addDiv({ class: 'bm-content' })
                    .addDiv({ class: 'bm-col bm-spaced' })
                        .addHeading(1, { textContent: 'Color Filter' }).up()
                    .up()
                    .addHr().up()
                    .addDiv({ class: 'bm-col bm-wrap bm-spaced', style: 'gap: 1.5ch;' })
                        .addButton({ textContent: 'None' },    (overlay, btn) => { btn.onclick = () => this.#setAllVisibility(false); }).up()
                        .addButton({ textContent: 'Refresh' }, (overlay, btn) => { btn.onclick = () => { btn.disabled = true; this.refreshStats(); btn.disabled = false; }; }).up()
                        .addButton({ textContent: 'All' },     (overlay, btn) => { btn.onclick = () => this.#setAllVisibility(true); }).up()
                    .up()
                    .addDiv({ class: 'bm-col bm-sections' }).up()
                .up()
            .mount(this.mountTarget);
            this.enableDragging(`#${this.windowId}.bm-window`, `#${this.windowId} .bm-titlebar`);

            const sectionsEl = document.querySelector(`#${this.windowId} .bm-sections`);
            this.#buildColorList(sectionsEl);
            this.#sortColorList(this.sortPrimary, this.sortSecondary, this.showUnused);
        }

        refreshStats() {
            this.#aggregateStats();
            const listEl   = document.querySelector(`#${this.listContainerId}`);
            const statsObj = {};
            for (const color of this.palette) {
                const total   = this.totalByColor.get(color.id) ?? 0;
                const correct = this.correctByColor.get(color.id) ?? 0;
                let correctStr = '0', pctStr = formatPercent(1);
                if (total !== 0) {
                    const corrVal = this.correctByColor.get(color.id) ?? '???';
                    if (typeof corrVal !== 'number' && this.tilesChecked === this.totalTiles && color.id) ;
                    correctStr = typeof corrVal === 'string' ? corrVal : formatNumber(corrVal);
                    pctStr     = isNaN(corrVal / total) ? '???' : formatPercent(corrVal / total);
                }
                const incorrect = parseInt(total) - parseInt(correct);
                statsObj[color.id] = { total, totalStr: formatNumber(total), correct, correctStr, pctStr, incorrect };
            }
            if (document.querySelector('#bm-compact-stats')) {
                const t = this.correctTotal.toString().length > 7 ? this.correctTotal.toString().slice(0, 2) + '…' + this.correctTotal.toString().slice(-3) : this.correctTotal.toString();
                const e = this.pixelsTotal.toString().length > 7 ? this.pixelsTotal.toString().slice(0, 2) + '…' + this.pixelsTotal.toString().slice(-3) : this.pixelsTotal.toString();
                this.setElementContent('bm-compact-stats', `${t}/${e}`, true);
            }
            if (!listEl) return statsObj;
            for (const row of Array.from(listEl.children)) {
                const colorId = parseInt(row.dataset.id);
                const { correct, correctStr, pctStr, total, totalStr, incorrect } = statsObj[colorId];
                row.dataset.correct   = Number.isNaN(parseInt(correct)) ? '0' : correct;
                row.dataset.total     = total;
                row.dataset.percent   = pctStr.endsWith('%') ? pctStr.slice(0, -1) : '0';
                row.dataset.incorrect = incorrect || 0;
                const statTextEl = document.querySelector(`#${this.windowId} .bm-color-row[data-id="${colorId}"] .bm-stat-text`);
                if (statTextEl) statTextEl.textContent = `${correctStr} / ${totalStr}`;
                const detailEl = document.querySelector(`#${this.windowId} .bm-color-row[data-id="${colorId}"] .bm-detail-text`);
                if (detailEl) detailEl.textContent = `${typeof incorrect !== 'number' || isNaN(incorrect) ? '???' : incorrect} incorrect pixel${incorrect === 1 ? '' : 's'}. Completed: ${pctStr}`;
            }
            this.#sortColorList(this.sortPrimary, this.sortSecondary, this.showUnused);
        }

        // ── Méthodes privées ──────────────────────────────────────

        #buildColorList(container) {
            const isCompact = container.closest(`#${this.windowId}`)?.classList.contains('bm-compact');
            const builder   = new Overlay(this.name, this.version);
            builder.addDiv({ id: this.listContainerId });
            const stats = this.refreshStats();

            for (const color of this.palette) {
                '#' + rgbToHex(color.rgb).toUpperCase();
                const lum      = calculateLuminance(color.rgb);
                let textColor  = 1.05 / (lum + 0.05) > (lum + 0.05) / 0.05 ? 'white' : 'black';
                if (!color.id) textColor = 'transparent';
                const textClass = textColor === 'white' ? 'bm-text-light' : 'bm-text-dark';
                const { correct, correctStr, pctStr, total, totalStr, incorrect } = stats[color.id];
                const isHidden = !!this.templateManager.hiddenColors.get(color.id);

                const eyeShownSvg  = this.#eyeShownSvg.replace('<svg', `<svg fill="${textColor}"`);
                const eyeHiddenSvg = this.#eyeHiddenSvg.replace('<svg', `<svg fill="${textColor}"`);

                if (isCompact) {
                    const starBg = `background-size: auto 100%; background-repeat: repeat-x; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50,5L79,91L2,39L98,39L21,91' fill='${textColor}' fill-opacity='.1'/></svg>");`;
                    builder.addDiv({
                        class: 'bm-col bm-color-row bm-wrap', 'data-id': color.id, 'data-name': color.name,
                        'data-premium': +color.premium, 'data-correct': Number.isNaN(parseInt(correct)) ? '0' : correct,
                        'data-total': total, 'data-percent': pctStr.endsWith('%') ? pctStr.slice(0, -1) : '0', 'data-incorrect': incorrect || 0
                    })
                        .addDiv({ class: 'bm-color-swatch', style: `background-color: rgb(${color.rgb?.map(v => Number(v) || 0).join(',')});${color.premium ? starBg : ''}` })
                            .addButton({
                                class: 'bm-eye-btn ' + textClass, 'data-state': isHidden ? 'hidden' : 'shown',
                                'aria-label': isHidden ? `Show the color ${color.name || ''} on templates.` : `Hide the color ${color.name || ''} on templates.`,
                                innerHTML: isHidden ? eyeHiddenSvg : eyeShownSvg
                            }, (ov, btn) => {
                                btn.onclick = () => {
                                    btn.style.textDecoration = 'none'; btn.disabled = true;
                                    if (btn.dataset.state === 'shown') {
                                        btn.innerHTML = eyeHiddenSvg; btn.dataset.state = 'hidden';
                                        btn.ariaLabel = `Show the color ${color.name || ''} on templates.`;
                                        this.templateManager.hiddenColors.set(color.id, true);
                                    } else {
                                        btn.innerHTML = eyeShownSvg; btn.dataset.state = 'shown';
                                        btn.ariaLabel = `Hide the color ${color.name || ''} on templates.`;
                                        this.templateManager.hiddenColors.delete(color.id);
                                    }
                                    btn.disabled = false; btn.style.textDecoration = '';
                                };
                                if (!color.id) btn.disabled = true;
                            }).up()
                        .up()
                        .addSmall({ textContent: `#${color.id.toString().padStart(2, 0)}`, style: `color: ${color.id === -1 || color.id === 0 ? 'white' : textColor}` }).up()
                        .addHeading(2, { textContent: color.name, style: `color: ${color.id === -1 || color.id === 0 ? 'white' : textColor}` }).up()
                        .addSmall({ class: 'bm-stat-text', textContent: `${correctStr} / ${totalStr}`, style: `color: ${color.id === -1 || color.id === 0 ? 'white' : textColor}; flex: 1 1 auto; text-align: right;` }).up()
                    .up();
                } else {
                    builder.addDiv({
                        class: 'bm-col bm-color-row bm-wrap', 'data-id': color.id, 'data-name': color.name,
                        'data-premium': +color.premium, 'data-correct': Number.isNaN(parseInt(correct)) ? '0' : correct,
                        'data-total': total, 'data-percent': pctStr.endsWith('%') ? pctStr.slice(0, -1) : '0', 'data-incorrect': incorrect || 0
                    })
                        .addDiv({ class: 'bm-row', style: 'flex-direction: column;' })
                            .addDiv({ class: 'bm-color-swatch', style: `background-color: rgb(${color.rgb?.map(v => Number(v) || 0).join(',')});` })
                                .addButton({
                                    class: 'bm-eye-btn ' + textClass, 'data-state': isHidden ? 'hidden' : 'shown',
                                    'aria-label': isHidden ? `Show the color ${color.name || ''} on templates.` : `Hide the color ${color.name || ''} on templates.`,
                                    innerHTML: isHidden ? eyeHiddenSvg : eyeShownSvg
                                }, (ov, btn) => {
                                    btn.onclick = () => {
                                        btn.style.textDecoration = 'none'; btn.disabled = true;
                                        if (btn.dataset.state === 'shown') {
                                            btn.innerHTML = eyeHiddenSvg; btn.dataset.state = 'hidden';
                                            btn.ariaLabel = `Show the color ${color.name || ''} on templates.`;
                                            this.templateManager.hiddenColors.set(color.id, true);
                                        } else {
                                            btn.innerHTML = eyeShownSvg; btn.dataset.state = 'shown';
                                            btn.ariaLabel = `Hide the color ${color.name || ''} on templates.`;
                                            this.templateManager.hiddenColors.delete(color.id);
                                        }
                                        btn.disabled = false; btn.style.textDecoration = '';
                                    };
                                    if (!color.id) btn.disabled = true;
                                }).up()
                            .up()
                            .addSmall({ textContent: color.id === -2 ? '???????' : formatNumber(total) }).up()
                        .up()
                        .addDiv({ class: 'bm-wrap' })
                            .addHeading(2, { textContent: (color.premium ? '★ ' : '') + color.name }).up()
                            .addDiv({ class: 'bm-wrap', style: 'gap: 1.5ch;' })
                                .addSmall({ textContent: `#${color.id.toString().padStart(2, 0)}` }).up()
                                .addSmall({ class: 'bm-stat-text', textContent: `${correctStr} / ${totalStr}` }).up()
                            .up()
                            .addParagraph({ class: 'bm-detail-text', textContent: `${typeof incorrect !== 'number' || isNaN(incorrect) ? '???' : incorrect} incorrect pixel${incorrect === 1 ? '' : 's'}. Completed: ${pctStr}` }).up()
                        .up()
                    .up();
                }
            }
            builder.up().mount(container);
        }

        #sortColorList(primary, secondary, showUnused) {
            this.sortPrimary   = primary;
            this.sortSecondary = secondary;
            this.showUnused    = showUnused;
            const listEl = document.querySelector(`#${this.listContainerId}`);
            if (!listEl) return;
            const rows = Array.from(listEl.children);
            rows.sort((a, b) => {
                const aVal = a.getAttribute('data-' + primary);
                const bVal = b.getAttribute('data-' + primary);
                const aNum = parseFloat(aVal), bNum = parseFloat(bVal);
                const bothNum = !isNaN(aNum) && !isNaN(bNum);
                if (showUnused) a.classList.remove('bm-hidden');
                else if (!Number(a.getAttribute('data-total'))) a.classList.add('bm-hidden');
                if (bothNum) return secondary === 'ascending' ? aNum - bNum : bNum - aNum;
                const al = aVal.toLowerCase(), bl = bVal.toLowerCase();
                return al < bl ? (secondary === 'ascending' ? -1 : 1) : al > bl ? (secondary === 'ascending' ? 1 : -1) : 0;
            });
            rows.forEach(row => listEl.appendChild(row));
        }

        #setAllVisibility(show) {
            const listEl = document.querySelector(`#${this.listContainerId}`);
            if (!listEl) return;
            for (const row of Array.from(listEl.children)) {
                if (row.classList.contains('bm-hidden')) continue;
                const btn = row.querySelector('.bm-color-swatch button');
                if (!btn) continue;
                if ((btn.dataset.state === 'hidden') === show) btn.click();
            }
        }

        #aggregateStats() {
            this.pixelsTotal    = 0;
            this.correctTotal   = 0;
            this.totalByColor   = new Map();
            this.correctByColor = new Map();
            this.tilesChecked   = 0;
            this.totalTiles     = 0;
            for (const tmpl of this.templateManager.templates) {
                const total = tmpl.pixelStats?.total ?? 0;
                this.pixelsTotal += total;
                const colors = tmpl.pixelStats?.colors ?? new Map();
                for (const [colorId, cnt] of colors) {
                    this.totalByColor.set(colorId, (this.totalByColor.get(colorId) ?? 0) + (Number(cnt) || 0));
                }
                const correct = tmpl.pixelStats?.correct ?? {};
                this.tilesChecked += Object.keys(correct).length;
                this.totalTiles   += Object.keys(tmpl.tiles ?? {}).length;
                for (const tileCorr of Object.values(correct)) {
                    for (const [colorId, cnt] of tileCorr) {
                        const val = Number(cnt) || 0;
                        this.correctTotal += val;
                        this.correctByColor.set(colorId, (this.correctByColor.get(colorId) ?? 0) + val);
                    }
                }
            }
            if (this.correctTotal >= this.pixelsTotal && this.pixelsTotal && this.tilesChecked === this.totalTiles) {
                new ConfettiManager().launch(document.querySelector(`#${this.windowId}`));
            }
            this.timeRemaining = new Date(30 * (this.pixelsTotal - this.correctTotal) * 1000 + Date.now());
            this.formattedEta  = formatDate(this.timeRemaining);
        }
    }

    class WindowMain extends Overlay {
        constructor(name, version) {
            super(name, version);
            this.windowId = 'bm-window-main';
        }

        toggle() {
            if (document.querySelector(`#${this.windowId}`)) {
                this.setError('Main window already exists!');
                return;
            }
            this.addDiv({ id: this.windowId, class: 'bm-window bm-compact', style: 'top: 10px; left: unset; right: 75px;' })
                .addTitleBar()
                    .addButton({ class: 'bm-chrome-btn', textContent: '▼', 'aria-label': 'Minimize window "Yet Another Wplace Overlay"', 'data-button-status': 'expanded' }, (overlay, btn) => {
                        btn.onclick    = () => overlay.toggleMinimize(btn);
                        btn.ontouchend = () => btn.click();
                    }).up()
                    .addDiv().up()
                .up()
                .addDiv({ class: 'bm-content' })
                    .addDiv({ class: 'bm-col' })
                        .addImage({ class: 'bm-logo-img' }).up()
                        .addHeading(1, { textContent: this.name }).up()
                    .up()
                    .addHr().up()
                    .addDiv({ class: 'bm-col' })
                        .addSpan({ id: 'bm-droplets',   textContent: 'Droplets:' }).up()
                        .addBr().up()
                        .addSpan({ id: 'bm-next-level', textContent: 'Next level in...' }).up()
                        .addBr().up()
                        .addSpan({ textContent: 'Charges: ' }).up()
                        .addCountdownTimer(Date.now(), 1000, { style: 'font-weight: 700;' }, (overlay, timerEl) => {
                            if (overlay.apiManager) overlay.apiManager.chargesTimerId = timerEl.id;
                        }).up()
                    .up()
                    .addHr().up()
                    .addDiv({ class: 'bm-col' })
                        .addDiv({ class: 'bm-col' })
                            .addButton({ class: 'bm-chrome-btn bm-jump-btn', style: 'margin-top: 0;', innerHTML: '<svg viewBox="0 0 4 6"><path d="M.5,3.4A2,2 0 1 1 3.5,3.4L2,6"/><circle cx="2" cy="2" r=".7" fill="#fff"/></svg>' }, (overlay, btn) => {
                                btn.onclick = () => {
                                    const coords = overlay.apiManager?.lastClickCoords;
                                    if (coords?.[0]) {
                                        overlay.setElementContent('bm-tile-x',  coords?.[0] || '');
                                        overlay.setElementContent('bm-tile-y',  coords?.[1] || '');
                                        overlay.setElementContent('bm-pixel-x', coords?.[2] || '');
                                        overlay.setElementContent('bm-pixel-y', coords?.[3] || '');
                                    } else {
                                        overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?');
                                    }
                                };
                            }).up()
                            .addInput({ type: 'number', id: 'bm-tile-x',  class: 'bm-coord-input', placeholder: 'Tl X', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                            }).up()
                            .addInput({ type: 'number', id: 'bm-tile-y',  class: 'bm-coord-input', placeholder: 'Tl Y', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                            }).up()
                            .addInput({ type: 'number', id: 'bm-pixel-x', class: 'bm-coord-input', placeholder: 'Px X', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                            }).up()
                            .addInput({ type: 'number', id: 'bm-pixel-y', class: 'bm-coord-input', placeholder: 'Px Y', min: 0, max: 2047, step: 1, required: true }, (overlay, inp) => {
                                inp.addEventListener('paste', e => this.#handleCoordPaste(overlay, inp, e));
                            }).up()
                        .up()
                        .addDiv({ class: 'bm-col' })
                            .addFileInput({ class: 'bm-file-upload', textContent: 'Upload Template', accept: 'image/png, image/jpeg, image/webp, image/bmp, image/gif' }).up()
                        .up()
                        .addDiv({ class: 'bm-col bm-wrap' })
                            .addButton({ textContent: 'Disable', 'data-button-status': 'shown' }, (overlay, btn) => {
                                btn.onclick = () => {
                                    btn.disabled = true;
                                    if (btn.dataset.buttonStatus === 'shown') {
                                        overlay.apiManager?.templateManager?.setEnabled(false);
                                        btn.dataset.buttonStatus = 'hidden';
                                        btn.textContent = 'Enable';
                                        overlay.setStatus('Disabled templates!');
                                    } else {
                                        overlay.apiManager?.templateManager?.setEnabled(true);
                                        btn.dataset.buttonStatus = 'shown';
                                        btn.textContent = 'Disable';
                                        overlay.setStatus('Enabled templates!');
                                    }
                                    btn.disabled = false;
                                };
                            }).up()
                            .addButton({ textContent: 'Create' }, (overlay, btn) => {
                                btn.onclick = () => {
                                    const fileInput = document.querySelector(`#${this.windowId} .bm-file-upload input[type="file"]`);
                                    const tileXInp  = document.querySelector('#bm-tile-x');
                                    const tileYInp  = document.querySelector('#bm-tile-y');
                                    const pixelXInp = document.querySelector('#bm-pixel-x');
                                    const pixelYInp = document.querySelector('#bm-pixel-y');
                                    if (!tileXInp.checkValidity())  { tileXInp.reportValidity();  return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                    if (!tileYInp.checkValidity())  { tileYInp.reportValidity();  return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                    if (!pixelXInp.checkValidity()) { pixelXInp.reportValidity(); return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                    if (!pixelYInp.checkValidity()) { pixelYInp.reportValidity(); return overlay.setError('Coordinates are malformed! Did you try clicking on the canvas first?'); }
                                    if (fileInput?.files[0]) {
                                        overlay.apiManager?.templateManager.createTemplate(fileInput.files[0], fileInput.files[0]?.name.replace(/\.[^/.]+$/, ''), [Number(tileXInp.value), Number(tileYInp.value), Number(pixelXInp.value), Number(pixelYInp.value)]);
                                        overlay.setStatus('Drew to canvas!');
                                    } else {
                                        overlay.setError('No file selected!');
                                    }
                                };
                            }).up()
                            .addButton({ textContent: 'Filter', 'data-bm-filter': '1' }, (overlay, btn) => {
                                btn.onclick = () => new WindowColorFilter(overlay).toggle();
                            }).up()
                        .up()
                    .up()
                    .addDiv({ class: 'bm-col' })
                        .addTextarea({ id: 'bm-status', placeholder: `Status: Sleeping...\nVersion: ${this.version}`, readOnly: true, class: 'bm-status-area' }).up()
                    .up()
                    .addDiv({ class: 'bm-col bm-wrap', style: 'margin-bottom: 0; flex-direction: column;' })
                        .addDiv({ class: 'bm-wrap' })
                            .addButton({ class: 'bm-chrome-btn', innerHTML: '⚙️', title: 'Settings' }, (overlay, btn) => {
                                btn.onclick = () => overlay.settingsManager.toggle();
                            }).up()
                            .addButton({ class: 'bm-chrome-btn', innerHTML: '🧙', title: 'Template Wizard' }, (overlay, btn) => {
                                btn.onclick = () => {
                                    const tm = overlay.apiManager?.templateManager;
                                    new WindowWizard(this.name, this.version, tm?.schemaVersion, tm).toggle();
                                };
                            }).up()
                            .addButton({ class: 'bm-chrome-btn', innerHTML: '🎨', title: 'Template Color Converter' }, (overlay, btn) => {
                                btn.onclick = () => window.open('https://pepoafonso.github.io/color_converter_wplace/', '_blank', 'noopener noreferrer');
                            }).up()
                        .up()
                    .up()
                .up()
            .mount(document.body);
            this.enableDragging(`#${this.windowId}.bm-window`, `#${this.windowId} .bm-titlebar`);
        }

        // ── Méthodes privées ──────────────────────────────────────

        async #handleCoordPaste(overlay, inputEl, event) {
            event.preventDefault();
            let text = '';
            if (event.clipboardData) {
                text = event.clipboardData.getData('text/plain');
            }
            if (!text) {
                await navigator.clipboard.readText().then(t => { text = t; }).catch(() => {
                    consoleLog('Failed to retrieve clipboard data using navigator! Using fallback methods...');
                });
            }
            if (!text) text = window.clipboardData?.getData('Text') ?? '';
            const nums = text.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
            if (nums.length === 2 && inputEl.id === 'bm-pixel-x') {
                overlay.setElementContent('bm-pixel-x', nums[0] || '');
                overlay.setElementContent('bm-pixel-y', nums[1] || '');
            } else if (nums.length === 1) {
                overlay.setElementContent(inputEl.id, nums[0] || '');
            } else {
                overlay.setElementContent('bm-tile-x',  nums[0] || '');
                overlay.setElementContent('bm-tile-y',  nums[1] || '');
                overlay.setElementContent('bm-pixel-x', nums[2] || '');
                overlay.setElementContent('bm-pixel-y', nums[3] || '');
            }
        }
    }

    function injectBridge(scriptName) {
        !function(bridgeFn) {
            const scriptEl = document.createElement('script');
            scriptEl.setAttribute('bm-name',  scriptName);
            scriptEl.setAttribute('bm-style', 'color: cornflowerblue;');
            scriptEl.textContent = `(${bridgeFn})();`;
            document.documentElement?.appendChild(scriptEl);
            scriptEl.remove();
        }(() => {
            const scriptEl   = document.currentScript;
            const scriptName = scriptEl?.getAttribute('bm-name')  || 'Yet Another Wplace Overlay';
            const logStyle   = scriptEl?.getAttribute('bm-style') || '';
            const blobQueue  = new Map();

            window.addEventListener('message', event => {
                const { source, blobID, blobData, endpoint } = event.data;
                if (source === 'yaw-overlay' && blobID && blobData && !endpoint) {
                    const resolve = blobQueue.get(blobID);
                    if (typeof resolve === 'function') {
                        resolve(blobData);
                    } else {
                        console.warn(`%c${scriptName}%c: Attempted to retrieve a blob (%s) from queue, but the blobID was not a function! Skipping...`, logStyle, '', blobID);
                    }
                    blobQueue.delete(blobID);
                }
            });

            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                const response     = await originalFetch.apply(this, args);
                const cloned       = response.clone();
                const url          = (args[0] instanceof Request ? args[0]?.url : args[0]) || 'ignore';
                const contentType  = cloned.headers.get('content-type') || '';

                if (contentType.includes('application/json')) {
                    cloned.json().then(data => {
                        window.postMessage({ source: 'yaw-overlay', endpoint: url, jsonData: data }, '*');
                    }).catch(() => {});
                } else if (contentType.includes('image/') && !url.includes('openfreemap') && !url.includes('maps')) {
                    const timestamp = Date.now();
                    const blob      = await cloned.blob();
                    return new Promise(resolve => {
                        const blobId = crypto.randomUUID();
                        blobQueue.set(blobId, processedBlob => {
                            resolve(new Response(processedBlob, {
                                headers:    cloned.headers,
                                status:     cloned.status,
                                statusText: cloned.statusText
                            }));
                        });
                        window.postMessage({
                            source:   'yaw-overlay',
                            endpoint: url,
                            blobID:   blobId,
                            blobData: blob,
                            blink:    timestamp
                        });
                    }).catch(() => { });
                }
                return response;
            };
        });
    }

    function injectStyles() {
        GM_addStyle(`
      /* ── Fenêtre principale ── */
      .bm-window {
        position: fixed;
        z-index: 9000;
        display: flex;
        flex-direction: column;
        width: 252px;
        background: #18181b;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.6);
        font-family: 'Roboto Mono', monospace, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        color: rgba(255,255,255,.75);
        user-select: none;
        -webkit-user-select: none;
        overflow: hidden;
      }

      /* ── Barre de titre ── */
      .bm-titlebar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        cursor: grab;
        flex-shrink: 0;
        min-height: 32px;
        background: rgba(255,255,255,.03);
        border-bottom: 1px solid rgba(255,255,255,.08);
      }
      .bm-dragging .bm-titlebar { cursor: grabbing; }
      .bm-titlebar > div {
        flex: 1;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,.8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ── Zone de contenu ── */
      .bm-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        overflow-y: auto;
        max-height: 80vh;
        transition: height .2s ease;
      }

      /* ── Groupes et lignes ── */
      .bm-col    { display: flex; flex-direction: column; gap: 4px; }
      .bm-row    { display: flex; flex-direction: row; align-items: center; gap: 4px; }
      .bm-wrap   { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 4px; }
      .bm-spaced { justify-content: space-between; }
      .bm-hidden { display: none !important; }

      /* Ligne de coordonnées : force la rangée horizontale */
      .bm-col > .bm-col:has(.bm-jump-btn) {
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px;
      }

      /* ── Séparateurs ── */
      .bm-window hr {
        border: none;
        border-top: 1px solid rgba(255,255,255,.08);
        margin: 2px 0;
      }

      /* ── Boutons chrome (minimize, close…) ── */
      .bm-chrome-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px 5px;
        line-height: 1;
        flex-shrink: 0;
        color: rgba(255,255,255,.45);
        border-radius: 4px;
        transition: color .12s, background .12s;
      }
      .bm-chrome-btn:hover { color: rgba(255,255,255,.85); background: rgba(255,255,255,.08); }
      .bm-chrome-btn svg { width: 1em; height: 1em; fill: currentColor; display: block; }

      /* ── Bouton saut de coordonnées ── */
      .bm-jump-btn {
        border: 1px solid rgba(255,255,255,.25) !important;
        border-radius: 50% !important;
        padding: 2px 5px !important;
        color: rgba(255,255,255,.6) !important;
        background: none !important;
        cursor: pointer !important;
        font-size: 11px !important;
        line-height: 1 !important;
        transition: background .12s, border-color .12s !important;
      }
      .bm-jump-btn:hover {
        background: rgba(255,255,255,.1) !important;
        border-color: rgba(255,255,255,.45) !important;
      }

      /* ── Boutons standard (hors chrome, swatches, circulaires) ── */
      .bm-window button:not(.bm-eye-btn):not(.bm-chrome-btn):not(.bm-info-btn):not(.bm-jump-btn) {
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.14);
        color: rgba(255,255,255,.78);
        border-radius: 5px;
        padding: 3px 8px;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        transition: background .12s, border-color .12s;
      }
      .bm-window button:not(.bm-eye-btn):not(.bm-chrome-btn):not(.bm-info-btn):not(.bm-jump-btn):hover {
        background: rgba(255,255,255,.14);
        border-color: rgba(255,255,255,.28);
      }

      /* ── Inputs & selects ── */
      .bm-window input[type="text"],
      .bm-window input[type="number"],
      .bm-window textarea,
      .bm-window select {
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 5px;
        color: rgba(255,255,255,.85);
        padding: 3px 6px;
        font-size: 11px;
        font-family: inherit;
        box-sizing: border-box;
      }
      .bm-window input:focus,
      .bm-window textarea:focus,
      .bm-window select:focus {
        outline: none;
        border-color: rgba(255,255,255,.35);
        background: rgba(255,255,255,.1);
      }

      /* Input de coordonnées (largeur fixe, pas de spinners) */
      .bm-coord-input {
        width: 5.5ch;
        font-size: 11px;
        font-family: inherit;
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .bm-coord-input::-webkit-inner-spin-button,
      .bm-coord-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      .bm-coord-input { -moz-appearance: textfield; }

      /* Zone de statut / textarea */
      .bm-status-area { width: 100%; min-height: 3.5em; resize: vertical; font-family: inherit; font-size: inherit; box-sizing: border-box; }

      /* ── Titres ── */
      .bm-window h1 { font-size: 13px; font-weight: 600; color: rgba(255,255,255,.9); margin: 0; }
      .bm-window h2 { font-size: 11px; font-weight: 500; color: rgba(255,255,255,.7); margin: 0; }

      /* ── Texte courant ── */
      .bm-window p, .bm-window label, .bm-window small { color: rgba(255,255,255,.6); margin: 0; }
      .bm-text-light { color: rgba(255,255,255,.9); }
      .bm-text-dark  { color: #000; }
      .bm-text-bold  { font-weight: bold; }
      .bm-countdown  { font-variant-numeric: tabular-nums; }

      /* ── Swatches couleur ── */
      .bm-color-swatch { width: 1.5rem; height: 1.5rem; flex-shrink: 0; border-radius: 3px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
      .bm-eye-btn      { background: none; border: none; cursor: pointer; padding: 0; width: 100%; height: 100%; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
      .bm-eye-btn svg  { width: 100%; height: 100%; }
      .bm-logo-img     { max-width: 1.5rem; max-height: 1.5rem; object-fit: contain; }

      /* ── Ligne couleur ── */
      .bm-color-row { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 4px; }
      .bm-color-row:hover { background: rgba(255,255,255,.05); }

      /* ── Grille de sous-pixels (3×3) ── */
      .bm-pixel-grid { display: grid; grid-template-columns: repeat(3, 1.6em); grid-template-rows: repeat(3, 1.6em); gap: 2px; }
      .bm-pixel-grid button { width: 100%; height: 100%; cursor: pointer; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.07); border-radius: 2px; font-size: 0; }
      .bm-pixel-grid button:hover { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.35); }
      .bm-pixel-grid button[data-status="Incorrect"] { background: rgba(220,60,60,.35); border-color: rgba(220,60,60,.6); }
      .bm-pixel-grid button[data-status="Template"]  { background: rgba(60,180,60,.35); border-color: rgba(60,180,60,.6); }

      /* ── Prévisualisation template ── */
      .bm-preset-cell   { display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .bm-template-thumb { width: 2.5rem; height: 2.5rem; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,.06); }
      .bm-template-info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

      /* ── Bouton info circulaire ── */
      .bm-info-btn {
        border: 1px solid rgba(255,255,255,.3);
        border-radius: 50%;
        background: none;
        cursor: pointer;
        width: 1.1em;
        height: 1.1em;
        font-size: 0.7em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        padding: 0;
        color: rgba(255,255,255,.5);
        transition: background .12s, border-color .12s;
      }
      .bm-info-btn:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.5); }

      /* ── Input fichier caché ── */
      .bm-file-upload { position: relative; }
      .bm-file-upload input[type="file"] { position: absolute; width: 0; height: 0; opacity: 0; }

      /* ── Scrollbars ── */
      .bm-window ::-webkit-scrollbar       { width: 4px; height: 4px; }
      .bm-window ::-webkit-scrollbar-track { background: transparent; }
      .bm-window ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 2px; }
      .bm-window ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.32); }
    `);

        let fontLinkEl;
        const FONT_PLACEHOLDER = 'robotoMonoInjectionPoint';
        if (FONT_PLACEHOLDER.indexOf('@font-face') + 1) {
            GM_addStyle(FONT_PLACEHOLDER);
        } else {
            fontLinkEl = document.createElement('link');
            fontLinkEl.href  = 'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap';
            fontLinkEl.rel   = 'preload';
            fontLinkEl.as    = 'style';
            fontLinkEl.onload = function() { this.onload = null; this.rel = 'stylesheet'; };
            document.head?.appendChild(fontLinkEl);
        }
    }

    const SCRIPT_NAME    = GM_info.script.name.toString();
    const SCRIPT_VERSION = GM_info.script.version.toString();

    injectBridge(SCRIPT_NAME);
    injectStyles();

    const savedSettings   = JSON.parse(GM_getValue('bmUserSettings', '{}'));
    const templateManager = new TemplateManager(SCRIPT_NAME, SCRIPT_VERSION);
    const apiManager      = new ApiManager(templateManager);
    const settingsManager = new SettingsManager(SCRIPT_NAME, SCRIPT_VERSION, savedSettings);
    const windowMain      = new WindowMain(SCRIPT_NAME, SCRIPT_VERSION);

    windowMain.setApiManager(apiManager);
    windowMain.setSettingsManager(settingsManager);
    templateManager.setWindowMain(windowMain);
    templateManager.setSettingsManager(settingsManager);

    const storedTemplates = JSON.parse(GM_getValue('bmTemplates', '{}'));
    templateManager.importFromStorage(storedTemplates);

    apiManager.startListening(windowMain);

    const initUI = () => {
        windowMain.toggle();

        new MutationObserver((mutations, observer) => {
            const colorOneEl = document.querySelector('#color-1');
            if (!colorOneEl) return;

            let moveBtnEl = document.querySelector('#bm-move-btn');
            if (!moveBtnEl) {
                moveBtnEl = document.createElement('button');
                moveBtnEl.id        = 'bm-move-btn';
                moveBtnEl.textContent = 'Move ↑';
                moveBtnEl.className = 'btn btn-soft';
                moveBtnEl.onclick   = function() {
                    const palette   = this.parentNode.parentNode.parentNode.parentNode;
                    const isMovingUp = this.textContent === 'Move ↑';
                    palette.parentNode.className = palette.parentNode.className.replace(
                        isMovingUp ? 'bottom' : 'top',
                        isMovingUp ? 'top' : 'bottom'
                    );
                    palette.style.borderTopLeftRadius     = isMovingUp ? '0px' : 'var(--radius-box)';
                    palette.style.borderTopRightRadius    = isMovingUp ? '0px' : 'var(--radius-box)';
                    palette.style.borderBottomLeftRadius  = isMovingUp ? 'var(--radius-box)' : '0px';
                    palette.style.borderBottomRightRadius = isMovingUp ? 'var(--radius-box)' : '0px';
                    this.textContent = isMovingUp ? 'Move ↓' : 'Move ↑';
                };
                const heading = colorOneEl.parentNode.parentNode.parentNode.parentNode.querySelector('h2');
                heading?.parentNode?.appendChild(moveBtnEl);
            }
        }).observe(document.body, { childList: true, subtree: true });

        consoleLog(`%c${SCRIPT_NAME}%c (${SCRIPT_VERSION}) userscript has loaded!`, 'color: cornflowerblue;', '');
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', initUI)
        : initUI();

})();
