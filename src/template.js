import { uint8ToBase64 } from './utils.js';

export class Template {
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
