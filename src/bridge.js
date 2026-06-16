export function injectBridge(scriptName) {
    const bridge = () => {
        const currentScript = document.currentScript;
        const scriptName    = currentScript?.getAttribute('yawo-name')  || 'Yet Another Wplace Overlay';
        const logStyle      = currentScript?.getAttribute('yawo-style') || '';
        const blobQueue     = new Map();

        // ── Ruler highlight ──
        // The overlay runs in an isolated world and can't touch window.realMap,
        // so the ruler's pixel highlights are drawn here (page context) where the
        // map's projection is available, and kept in sync on every map render.
        const WORLD_PX = 2048000; // canvas width/height in pixels (2048 tiles × 1000)
        let rulerPoints = [];     // [ [globalX, globalY], ... ] max 2
        let rulerListenersAttached = false;

        const pxToLngLat = (gx, gy) => [
            (gx / WORLD_PX) * 360 - 180,
            Math.atan(Math.sinh(Math.PI * (1 - 2 * gy / WORLD_PX))) * (180 / Math.PI),
        ];

        function ensureRulerLayer() {
            let layer = document.getElementById('yawo-ruler-layer');
            if (layer) return layer;
            layer = document.createElement('div');
            layer.id = 'yawo-ruler-layer';
            layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8000;';
            const SVG_NS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(SVG_NS, 'svg');
            svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;');
            const line = document.createElementNS(SVG_NS, 'line');
            line.id = 'yawo-ruler-svg-line';
            line.setAttribute('class', 'yawo-ruler-line');
            svg.appendChild(line);
            layer.appendChild(svg);
            for (const tag of ['a', 'b']) {
                const m = document.createElement('div');
                m.id = `yawo-ruler-marker-${tag}`;
                m.className = 'yawo-ruler-marker';
                const lbl = document.createElement('span');
                lbl.className = 'yawo-ruler-marker__label';
                lbl.textContent = tag.toUpperCase();
                m.appendChild(lbl);
                layer.appendChild(m);
            }
            document.body.appendChild(layer);
            return layer;
        }

        function renderRulerHighlight() {
            const layer = ensureRulerLayer();
            const map   = window.realMap;
            const markerA = document.getElementById('yawo-ruler-marker-a');
            const markerB = document.getElementById('yawo-ruler-marker-b');
            const line    = document.getElementById('yawo-ruler-svg-line');
            if (!map || rulerPoints.length === 0) { layer.style.display = 'none'; return; }
            layer.style.display = '';
            const rect = map.getCanvas().getBoundingClientRect();
            const MIN  = 10; // keep the marker grabbable even when a pixel is sub-pixel on screen
            const place = (marker, [gx, gy]) => {
                const tl = map.project(pxToLngLat(gx, gy));
                const br = map.project(pxToLngLat(gx + 1, gy + 1));
                const cx = rect.left + (tl.x + br.x) / 2;
                const cy = rect.top  + (tl.y + br.y) / 2;
                const size = Math.max(Math.abs(br.x - tl.x), Math.abs(br.y - tl.y), MIN);
                marker.style.display = '';
                marker.style.left   = `${cx - size / 2}px`;
                marker.style.top    = `${cy - size / 2}px`;
                marker.style.width  = `${size}px`;
                marker.style.height = `${size}px`;
                return { cx, cy };
            };
            const a = place(markerA, rulerPoints[0]);
            if (rulerPoints.length > 1) {
                const b = place(markerB, rulerPoints[1]);
                line.style.display = '';
                line.setAttribute('x1', a.cx); line.setAttribute('y1', a.cy);
                line.setAttribute('x2', b.cx); line.setAttribute('y2', b.cy);
            } else {
                markerB.style.display = 'none';
                line.style.display = 'none';
            }
            // Track the map: reposition the highlight on every frame it renders.
            if (!rulerListenersAttached) {
                map.on('render', renderRulerHighlight);
                window.addEventListener('resize', renderRulerHighlight);
                rulerListenersAttached = true;
            }
        }

        function captureMap(map) {
            if (window.realMap || !map || typeof map.getCenter !== 'function' || !map._canvas) return;
            window.realMap = map;
            delete Object.prototype._map;
            console.log(`%c[${scriptName}] 🎯 Carte capturée !`, logStyle);
        }

        Object.defineProperty(Object.prototype, '_map', {
            configurable: true,
            enumerable:   false,
            get() { return undefined; },
            set(value) {
                let stored = value;
                Object.defineProperty(this, '_map', {
                    configurable: true,
                    enumerable:   false,
                    get()  { return stored; },
                    set(v) { stored = v; captureMap(v); }
                });
                captureMap(value);
            }
        });

        window.addEventListener('message', event => {
            if (event.origin !== window.location.origin) return;
            const { source, blobID, blobData, endpoint, coords, zoom, select, speed, rulerHighlight } = event.data;

            if (source === 'yaw-overlay' && Array.isArray(rulerHighlight)) {
                rulerPoints = rulerHighlight;
                renderRulerHighlight();
            }

            if (source === 'yaw-overlay' && coords) {
                if (window.realMap) {
                    let globalX = 0;
                    let globalY = 0;

                    if (Array.isArray(coords)) {
                        if (coords.length === 4) {
                            globalX = (Number(coords[0]) * 1000) + Number(coords[2]);
                            globalY = (Number(coords[1]) * 1000) + Number(coords[3]);
                        } else if (coords.length === 2) {
                            globalX = Number(coords[0]);
                            globalY = Number(coords[1]);
                        }
                    } else if (typeof coords === 'object' && coords !== null) {
                        globalX = Number(coords.x || coords.globalX || 0);
                        globalY = Number(coords.y || coords.globalY || 0);
                    }

                    if (globalX > 0 && globalY > 0) {
                        // Aim at the pixel center (+0.5) so a simulated click lands
                        // unambiguously inside the pixel, not on a pixel boundary.
                        const lng = ((globalX + 0.5) / 2048000) * 360 - 180;
                        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (globalY + 0.5) / 2048000))) * (180 / Math.PI);
                        // flyTo animates zoom-out -> pan -> zoom-in (like wplace's native
                        // navigation) instead of teleporting. essential:true keeps the
                        // animation even with prefers-reduced-motion enabled.
                        const map = window.realMap;
                        map.flyTo({ center: [lng, lat], zoom: zoom ?? 12, speed: speed ?? 1.2, essential: true });

                        if (select) {
                            // Simulate a real canvas click to select the pixel, but only
                            // once the flight has ended: project() must read the camera's
                            // final position to map [lng, lat] to the correct screen point.
                            map.once('moveend', () => {
                                const canvas  = map.getCanvas();
                                const point   = map.project([lng, lat]);
                                const rect    = canvas.getBoundingClientRect();
                                const clientX = rect.left + point.x;
                                const clientY = rect.top  + point.y;
                                const base    = { bubbles: true, cancelable: true, view: window, clientX, clientY, button: 0 };
                                canvas.dispatchEvent(new PointerEvent('pointerdown', { ...base, buttons: 1, pointerId: 1, isPrimary: true }));
                                canvas.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
                                canvas.dispatchEvent(new PointerEvent('pointerup', { ...base, buttons: 0, pointerId: 1, isPrimary: true }));
                                canvas.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
                                canvas.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
                            });
                        }
                    } else {
                        console.warn(`%c${scriptName}%c: Unknown coordonate format :`, logStyle, '', coords);
                    }
                } else {
                    console.error(`%c${scriptName}%c: Navigation error — map wasn't loaded.`, logStyle, '');
                }
            }

            if (source === 'yaw-overlay' && blobID && blobData && !endpoint && !coords) {
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
            const response    = await originalFetch.apply(this, args);
            const cloned      = response.clone();
            const url         = (args[0] instanceof Request ? args[0]?.url : args[0]) || 'ignore';
            const contentType = cloned.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                cloned.json().then(data => {
                    window.postMessage({ source: 'yaw-overlay', endpoint: url, jsonData: data }, window.location.origin);
                }).catch(() => {});
            } else if (contentType.includes('image/') && !url.includes('openfreemap') && !url.includes('maps')) {
                const blob = await cloned.blob();
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
                        blobData: blob
                    }, window.location.origin);
                }).catch(() => {});
            }
            return response;
        };
    };

    const script = document.createElement('script');
    script.setAttribute('yawo-name',  scriptName);
    script.setAttribute('yawo-style', 'color: cornflowerblue;');
    script.textContent = `(${bridge})();`;
    document.documentElement?.appendChild(script);
    script.remove();
}
