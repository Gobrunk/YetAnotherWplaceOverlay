export function injectBridge(scriptName) {
    !function(bridgeFn) {
        const scriptEl = document.createElement('script');
        scriptEl.setAttribute('yawo-name',  scriptName);
        scriptEl.setAttribute('yawo-style', 'color: cornflowerblue;');
        scriptEl.textContent = `(${bridgeFn})();`;
        document.documentElement?.appendChild(scriptEl);
        scriptEl.remove();
    }(() => {
        const scriptEl   = document.currentScript;
        const scriptName = scriptEl?.getAttribute('yawo-name')  || 'Yet Another Wplace Overlay';
        const logStyle   = scriptEl?.getAttribute('yawo-style') || '';
        const blobQueue  = new Map();

        window.addEventListener('message', event => {
            const { source, blobID, blobData, endpoint } = event.data;
            if (Date.now(), source === 'yaw-overlay' && blobID && blobData && !endpoint) {
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
                }).catch(() => { Date.now(); });
            }
            return response;
        };
    });
}
