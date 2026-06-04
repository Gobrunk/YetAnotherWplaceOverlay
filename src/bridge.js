export function injectBridge(scriptName) {
    const bridge = () => {
        const currentScript = document.currentScript;
        const scriptName    = currentScript?.getAttribute('yawo-name')  || 'Yet Another Wplace Overlay';
        const logStyle      = currentScript?.getAttribute('yawo-style') || '';
        const blobQueue     = new Map();

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
            const { source, blobID, blobData, endpoint, coords, zoom, select } = event.data;

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
                        map.flyTo({ center: [lng, lat], zoom: zoom ?? 12, essential: true });

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
