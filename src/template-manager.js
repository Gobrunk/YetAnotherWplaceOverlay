import { Template } from './template.js';
import { COLOR_PALETTE } from './palette.js';
import { encodeBase, base64ToUint8, uint8ToBase64, sleep, consoleLog, consoleError, consoleWarn, formatNumber } from './utils.js';

export class TemplateManager {
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
        this.storageData          = null;
        this.templates            = [];
        this.activeTemplateKey    = null;
        this.windowTemplateSelect = null;
        this.isEnabled            = true;
        this.hiddenColors    = new Map();
        this._soloMode = false;
        this._soloObs  = null;
        this.liveTileCache = {};
    }

    setWindowMain(windowMain)        { this.windowMain      = windowMain; }
    setSettingsManager(settingsManager) { this.settingsManager = settingsManager; }

    async createTemplate(file, displayName, coords) {
        if (!this.storageData) this.storageData = await this.#createEmptyStorage();
        this.windowMain.setStatus(`Creating template at ${coords.join(', ')}...`);

        const tmpl = new Template({
            displayName,
            sortId:   Date.now(),
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
        this.templates.push(tmpl);
        this.activeTemplateKey = `${tmpl.sortId} ${tmpl.authorId}`;
        if (this.settingsManager?.settings) this.settingsManager.settings.activeTemplateKey = this.activeTemplateKey;
        this.windowMain?.updateActiveOverlayName(tmpl.displayName);
        this.windowMain.setStatus(`Template created at ${coords.join(', ')}!`);
        await this.#saveToStorage();
        this.windowTemplateSelect?.refresh();
    }

    async deleteTemplate(key) {
        this.templates = this.templates.filter(t => `${t.sortId} ${t.authorId}` !== key);
        if (this.storageData?.templates) delete this.storageData.templates[key];
        if (this.activeTemplateKey === key) {
            const first = this.templates[0];
            this.activeTemplateKey = first ? `${first.sortId} ${first.authorId}` : null;
        }
        if (this.settingsManager?.settings) this.settingsManager.settings.activeTemplateKey = this.activeTemplateKey;
        this.windowMain?.updateActiveOverlayName(this.#getActiveDisplayName());
        await this.#saveToStorage();
        this.windowTemplateSelect?.refresh();
    }

    setActiveTemplate(key) {
        this.activeTemplateKey = key;
        if (this.settingsManager?.settings) this.settingsManager.settings.activeTemplateKey = key;
        this.windowMain?.updateActiveOverlayName(this.#getActiveDisplayName());
        this.windowTemplateSelect?.refresh();
    }

    async renameTemplate(key, newName) {
        const trimmed = newName.trim();
        if (!trimmed) return;
        const tmpl = this.templates.find(t => `${t.sortId} ${t.authorId}` === key);
        if (!tmpl) return;
        tmpl.displayName = trimmed;
        if (this.storageData?.templates?.[key]) this.storageData.templates[key].name = trimmed;
        await this.#saveToStorage();
        this.windowTemplateSelect?.refresh();
        if (key === this.activeTemplateKey) this.windowMain?.updateActiveOverlayName(trimmed);
    }

    async downloadAllTemplates() {
        consoleLog('Downloading all templates...');
        for (const tmpl of this.templates) {
            await this.#downloadTemplate(tmpl);
            await sleep(500);
        }
    }

    async generateShareCode(key) {
        const entry = this.storageData?.templates?.[key];
        if (!entry) throw new Error('Template not found');
        const blob   = await this.compositeTemplateTiles({ tiles: entry.tiles });
        const bytes  = new Uint8Array(await blob.arrayBuffer());
        const coords = entry.coords.replace(/\s/g, '');
        return `YAWO:v1:${coords}:${uint8ToBase64(bytes)}`;
    }

    async importFromShareCode(code, displayName) {
        const parts = code.trim().split(':');
        if (parts[0] !== 'YAWO' || parts[1] !== 'v1' || parts.length < 4)
            throw new Error('Invalid share code');
        const coords = parts[2].split(',').map(Number);
        if (coords.length !== 4 || coords.some(isNaN))
            throw new Error('Invalid coordinates in code');
        const imgB64 = parts.slice(3).join(':');
        const bytes  = base64ToUint8(imgB64);
        const file   = new File([bytes], 'shared.png', { type: 'image/png' });
        const name   = displayName?.trim() || `Import ${coords[0]},${coords[1]}`;
        await this.createTemplate(file, name, coords);
    }

    async loadFromStorage() {
        const stored = JSON.parse(GM_getValue('yawoTemplates', '{}')).templates;
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
        // Phase 1: check if at least one template covers this tile
        const anyCovers = this.templates.some(t =>
            Object.keys(t.tiles).some(k => k.startsWith(coordKey))
        );
        if (!anyCovers) {
            this.windowMain.setStatus(`Sleeping\nVersion: ${this.version}`);
            return tileBlob;
        }

        // Phase 2: decode and cache live pixels for all templates
        const liveBitmap = await createImageBitmap(tileBlob);
        const canvas     = new OffscreenCanvas(scaledSize, scaledSize);
        const ctx        = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.beginPath(); ctx.rect(0, 0, scaledSize, scaledSize); ctx.clip();
        ctx.clearRect(0, 0, scaledSize, scaledSize);
        ctx.drawImage(liveBitmap, 0, 0, scaledSize, scaledSize);

        const liveImageData = ctx.getImageData(0, 0, scaledSize, scaledSize);
        const livePixels    = new Uint32Array(liveImageData.data.buffer);
        this.liveTileCache[coordKey] = livePixels;

        // Phase 3: filter on the active template for rendering
        const toRender   = this.activeTemplateKey
            ? this.templates.filter(t => `${t.sortId} ${t.authorId}` === this.activeTemplateKey)
            : this.templates;
        const sorted     = [...toRender].sort((a, b) => a.sortId - b.sortId);
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

        const visibleCount = toRender.filter(t => Object.keys(t.tiles).some(k => k.startsWith(coordKey))).length;
        const totalPx      = formatNumber(toRender.filter(t => Object.keys(t.tiles).some(k => k.startsWith(coordKey))).reduce((acc, t) => acc + (t.pixelStats.total || 0), 0));
        this.windowMain.setStatus(`Displaying ${visibleCount} template${visibleCount === 1 ? '' : 's'}.\nTotal pixels: ${totalPx}`);

        const overlayOpacity = this.settingsManager?.settings?.overlayOpacity ?? 1.0;

        for (const entry of matching) {
            const hasErased   = !!entry.template.pixelStats?.colors?.get(-1);
            let templatePixels = entry.pixelData?.slice();
            const offsetX = Number(entry.pixelOffset[0]) * this.pixelsPerTile;
            const offsetY = Number(entry.pixelOffset[1]) * this.pixelsPerTile;

            if (this.hiddenColors.size === 0 && !hasErased) {
                ctx.globalAlpha = overlayOpacity;
                ctx.drawImage(entry.tileBitmap, offsetX, offsetY);
                ctx.globalAlpha = 1;
            }

            if (!templatePixels) {
                const img = ctx.getImageData(offsetX, offsetY, entry.tileBitmap.width, entry.tileBitmap.height);
                templatePixels = new Uint32Array(img.data.buffer);
            }

            const { correctMap, outputPixels } = this.#computePixelDiff({
                livePixels, templatePixels,
                region: [offsetX, offsetY, entry.tileBitmap.width, entry.tileBitmap.height]
            });

            if (this.hiddenColors.size !== 0 || hasErased) {
                ctx.globalAlpha = overlayOpacity;
                ctx.drawImage(await createImageBitmap(new ImageData(new Uint8ClampedArray(outputPixels.buffer), entry.tileBitmap.width, entry.tileBitmap.height)), offsetX, offsetY);
                ctx.globalAlpha = 1;
            }

        }
        return canvas.convertToBlob({ type: 'image/png' });
    }

    importFromStorage(data) {
        if (data?.whoami === 'YAWO') this.#importTemplates(data);
    }

    setEnabled(enabled) { this.isEnabled = enabled; }

    loadFilterState(settings) {
        const hidden = settings?.hiddenColors;
        if (Array.isArray(hidden))
            this.hiddenColors = new Map(hidden.map(id => [id, true]));
        if (typeof settings?.soloMode === 'boolean')
            this._soloMode = settings.soloMode;
        if (settings?.activeTemplateKey)
            this.activeTemplateKey = settings.activeTemplateKey;
    }

    saveFilterState() {
        if (!this.settingsManager?.settings) return;
        this.settingsManager.settings.hiddenColors = [...this.hiddenColors.keys()];
        this.settingsManager.settings.soloMode     = this._soloMode;
    }

    async refreshCorrectStats() {
        for (const tmpl of this.templates) {
            if (!tmpl.pixelStats.correct) tmpl.pixelStats.correct = {};
            for (const tileKey of Object.keys(tmpl.tiles)) {
                const parts    = tileKey.split(',');
                const coordKey = parts[0] + ',' + parts[1];
                const cached   = this.liveTileCache[coordKey];
                if (!cached) continue;
                const tileBitmap   = tmpl.tiles[tileKey];
                const offsetX      = Number(parts[2]) * this.pixelsPerTile;
                const offsetY      = Number(parts[3]) * this.pixelsPerTile;
                let templatePixels = tmpl.pixelData?.[tileKey]?.slice();
                if (!templatePixels) continue;
                const { correctMap } = this.#computePixelDiff({
                    livePixels: cached, templatePixels,
                    region: [offsetX, offsetY, tileBitmap.width, tileBitmap.height]
                });
                tmpl.pixelStats.correct[coordKey] = correctMap;
            }
        }
        this.#saveCorrectToStorage();
    }

    getActiveDisplayName() { return this.#getActiveDisplayName(); }

    // ── Private methods ───────────────────────────────────────

    #getActiveDisplayName() {
        const tmpl = this.templates.find(t => `${t.sortId} ${t.authorId}` === this.activeTemplateKey);
        return tmpl?.displayName ?? '—';
    }

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
            whoami:        'YAWO',
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
        GM.setValue('yawoTemplates', JSON.stringify(this.storageData));
    }

    #saveCorrectToStorage() {
        if (!this.storageData) return;
        for (const tmpl of this.templates) {
            const entry = this.storageData.templates[`${tmpl.sortId} ${tmpl.authorId}`];
            if (!entry) continue;
            entry.correct = {};
            for (const [coordKey, map] of Object.entries(tmpl.pixelStats?.correct ?? {}))
                entry.correct[coordKey] = Object.fromEntries(map);
        }
        GM.setValue('yawoTemplates', JSON.stringify(this.storageData));
    }

    async #importTemplates(data) {
        const entries      = data.templates;
        const storedVer    = data?.schemaVersion?.split(/[-\.+]/) ?? [];
        const currentVer   = this.schemaVersion.split(/[-\.+]/);
        const scriptVer    = data?.scriptVersion;

        if (storedVer[0] === currentVer[0]) {
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
                        const tmpl = new Template({ displayName: name, sortId: sortId || loaded.length || 0, authorId: authorId || '' });
                        tmpl.pixelStats = pixelStats;
                        if (entry.correct) {
                            tmpl.pixelStats.correct = {};
                            for (const [coordKey, colorObj] of Object.entries(entry.correct))
                                tmpl.pixelStats.correct[coordKey] = new Map(
                                    Object.entries(colorObj).map(([k, v]) => [Number(k), v])
                                );
                        }
                        tmpl.tiles      = imageBitmaps;
                        tmpl.pixelData  = pixelDataMap;
                        loaded.push(tmpl);
                    }
                }
                return loaded;
            })({ tileSize: this.tileSize, pixelsPerTile: this.pixelsPerTile, templates: entries });
            this.storageData = data;
            if (!this.activeTemplateKey && this.templates.length > 0) {
                const first = this.templates[0];
                this.activeTemplateKey = `${first.sortId} ${first.authorId}`;
            }
            this.windowMain?.updateActiveOverlayName(this.#getActiveDisplayName());
        } else if (storedVer[0] < currentVer[0]) {
        } else {
            this.windowMain.setError(`Template version ${data?.schemaVersion} is unsupported.\nUse Yet Another Wplace Overlay version ${scriptVer} or load a new template.`);
        }
    }

    findNearestIncorrectPixel(colorId = null, refCoords = null) {
        const scale      = this.pixelsPerTile;
        const canvasSize = this.tileSize * scale;
        const { jt: colorLookup } = this.paletteCache;
        const tolerance  = this.paletteTolerance;
        const activeKey  = this.activeTemplateKey;
        const templates  = activeKey
            ? this.templates.filter(t => `${t.sortId} ${t.authorId}` === activeKey)
            : this.templates;

        const refAbsX = refCoords ? Number(refCoords[0]) * this.tileSize + Number(refCoords[2]) : null;
        const refAbsY = refCoords ? Number(refCoords[1]) * this.tileSize + Number(refCoords[3]) : null;
        let bestCoords = null;
        let bestDist   = Infinity;

        for (const tmpl of templates) {
            for (const tileKey of Object.keys(tmpl.tiles).sort()) {
                const parts    = tileKey.split(',');
                const tileX    = Number(parts[0]);
                const tileY    = Number(parts[1]);
                const pixelOX  = Number(parts[2]);
                const pixelOY  = Number(parts[3]);
                const coordKey = parts[0] + ',' + parts[1];
                const livePixels     = this.liveTileCache[coordKey];
                if (!livePixels) continue;
                const templatePixels = tmpl.pixelData?.[tileKey];
                if (!templatePixels) continue;
                const tileBitmap = tmpl.tiles[tileKey];
                const regionW    = tileBitmap.width;
                const regionH    = tileBitmap.height;
                const offsetX    = pixelOX * scale;
                const offsetY    = pixelOY * scale;

                for (let row = 1; row < regionH; row += scale) {
                    for (let col = 1; col < regionW; col += scale) {
                        const liveY     = offsetY + row - 1;
                        const liveX     = offsetX + col;
                        const livePx    = livePixels[liveY * canvasSize + liveX];
                        const tmplPx    = templatePixels[row * regionW + col];
                        const tmplA     = tmplPx >>> 24 & 255;
                        const liveA     = livePx >>> 24 & 255;
                        if (tmplA <= tolerance) continue;
                        const tmplColor = colorLookup.get(tmplPx) ?? -2;
                        if (tmplColor === -2) continue;
                        const liveColor = colorLookup.get(livePx) ?? -2;

                        const isCorrect = tmplColor === -1
                            ? liveA <= tolerance
                            : liveA > tolerance && liveColor === tmplColor;

                        if (!isCorrect) {
                            if (colorId !== null && tmplColor !== colorId) continue;
                            const px = pixelOX + (col - 1) / scale;
                            const py = pixelOY + (row - 1) / scale;
                            if (refAbsX === null) {
                                console.log(`🎯 Direction le pixel !`, tileX, tileY, px, py);
                                return [tileX, tileY, px, py];
                            }
                            const absX = tileX * this.tileSize + px;
                            const absY = tileY * this.tileSize + py;
                            const dx = absX - refAbsX;
                            const dy = absY - refAbsY;
                            const dist = dx * dx + dy * dy;
                            if (dist < bestDist) { bestDist = dist; bestCoords = [tileX, tileY, px, py]; }
                        }
                    }
                }
            }
        }
        if (bestCoords) console.log(`🎯 Direction le pixel !`, ...bestCoords);
        return bestCoords;
    }

    #computePixelDiff({ livePixels, templatePixels, region }) {
        const scale       = this.pixelsPerTile;
        const canvasSize  = this.tileSize * scale;
        const [offsetX, offsetY, regionW, regionH] = region;
        const tolerance   = this.paletteTolerance;
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

                // Hidden color: replace with live pixel
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
