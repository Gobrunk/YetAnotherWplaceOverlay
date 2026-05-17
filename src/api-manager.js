import { formatNumber } from './utils.js';

export class ApiManager {
    constructor(templateManager) {
        this.templateManager = templateManager;
        this.robotsBlocked   = false;
        this.chargesTimerId  = '';
        this.lastClickCoords = [];
    }

    navigateToCoords(coords) {
        if (!coords?.length) return;
        window.postMessage({ source: 'yaw-overlay', action: 'navigate', coords }, window.location.origin);
    }

    startListening(windowMain) {
        window.addEventListener('message', async event => {
            if (event.origin !== window.location.origin) return;
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
                    windowMain.setElementContent('yawo-droplets',   `<b>${formatNumber(jsonData.droplets)}</b>`);
                    windowMain.setElementContent('yawo-next-level',  `<b>${formatNumber(pixelsToNextLevel)}</b> pixel${pixelsToNextLevel === 1 ? '' : 's'}`);
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
                            let coordsDisplay = document.querySelector('#yawo-coords-display');
                            const labels   = ['Tl X:', 'Tl Y:', 'Px X:', 'Px Y:'];
                            const ids      = ['yawo-coords-tile-x', 'yawo-coords-tile-y', 'yawo-coords-pixel-x', 'yawo-coords-pixel-y'];
                            const allCoords = [...tileSegments, ...pixelCoords];
                            if (coordsDisplay) {
                                for (const [idx, id] of ids.entries())
                                    document.getElementById(id).textContent = `${labels[idx] ?? '??:'} ${allCoords[idx]}`;
                            } else {
                                coordsDisplay = document.createElement('span');
                                coordsDisplay.id = 'yawo-coords-display';
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
                    }, window.location.origin);
                    break;
                }
                case 'robots':
                    this.robotsBlocked = jsonData.userscript?.toString().toLowerCase() === 'false';
                    break;
            }
        });
    }
}
