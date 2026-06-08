import { buildTitlebar, buildFooter } from './windows/common.js';

export class Overlay {
    #rootElement   = null;
    #currentParent = null;
    #parentStack   = [];
    #statusAreaId  = 'yawo-status';

    constructor(name, version) {
        this.name           = name;
        this.version        = version;
        this.apiManager     = null;
        this.settingsManager = null;
    }

    // ── Dependency injection ──────────────────────────────────

    setApiManager(mgr)      { this.apiManager = mgr; }
    setSettingsManager(mgr) { this.settingsManager = mgr; }

    // ── Hierarchy navigation ──────────────────────────────────

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

    // ── Element creation ──────────────────────────────────────

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

    // ── Standard HTML elements ────────────────────────────────

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

    addHeading(level, attrs = {}, cb = () => {}) {
        cb(this, this.#createElement('h' + level, {}, attrs));
        return this;
    }

    addHr(attrs = {}, cb = () => {}) {
        cb(this, this.#createElement('hr', {}, attrs));
        return this;
    }

    // ── Form elements ─────────────────────────────────────────

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

    // ── Special elements ──────────────────────────────────────

    addTitleBar(attrs = {}, cb = () => {}) {
        cb(this, this.#createElement('div', { class: 'yawo-titlebar' }, attrs));
        return this;
    }

    // Append a shared title bar / footer to the current parent. Self-contained, so we
    // don't push onto the parent stack — chaining continues at the window level.
    addWindowHeader(opts = {}) {
        this.#currentParent.appendChild(buildTitlebar({ ...opts, onMinimize: btn => this.toggleMinimize(btn) }));
        return this;
    }

    addWindowFooter(opts = {}) {
        this.#currentParent.appendChild(buildFooter(opts));
        return this;
    }

    addCountdownTimer(endTimestamp = Date.now(), intervalMs = 500, attrs = {}, cb = () => {}) {
        const id = attrs.id || 'yawo-countdown-' + crypto.randomUUID().slice(0, 8);
        const timeEl = this.#createElement('time', { class: 'yawo-countdown' }, attrs);
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

    // ── DOM manipulation ──────────────────────────────────────

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

    // ── Window: minimize / drag ───────────────────────────────

    toggleMinimize(btn) {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.style.textDecoration = 'none';
        const windowEl  = btn.closest('.yawo-window');
        const titlebar  = btn.closest('.yawo-titlebar');
        const contentEl = windowEl.querySelector('.yawo-content');
        const footerEl  = windowEl.querySelector('.yawo-footer');
        const heading   = contentEl?.querySelector('h1');
        if (windowEl.parentElement) windowEl.parentElement.append(windowEl);
        if ('expanded' === btn.dataset.buttonStatus) {
            const savedResizeH = windowEl.style.height;
            if (savedResizeH) {
                windowEl.dataset.savedResizeH = savedResizeH;
                windowEl.style.height = '';
                windowEl.classList.remove('yawo-window-resized');
            }
            contentEl.style.height  = contentEl.scrollHeight + 'px';
            windowEl.style.minWidth = windowEl.clientWidth + 'px';
            contentEl.style.height  = '0';
            contentEl.addEventListener('transitionend', function handler() {
                contentEl.style.display = 'none';
                btn.disabled = false;
                btn.style.textDecoration = '';
                contentEl.removeEventListener('transitionend', handler);
            });
            if (footerEl) footerEl.style.display = 'none';
            const label = heading?.textContent ?? titlebar.querySelector('h1')?.textContent ?? '';
            if (heading) {
                const clone = heading.cloneNode(true);
                clone.classList.add('yawo-minimized-heading');
                btn.nextElementSibling.appendChild(clone);
            }
            // The chevron glyph is an SVG; CSS rotates it based on buttonStatus.
            btn.dataset.buttonStatus = 'collapsed';
            btn.ariaLabel = `Unminimize window "${label}"`;
        } else {
            if (footerEl) footerEl.style.display = '';
            const clonedHeading = btn.nextElementSibling?.querySelector('.yawo-minimized-heading');
            const label         = clonedHeading?.textContent ?? titlebar.querySelector('h1')?.textContent ?? '';
            clonedHeading?.remove();
            const savedResizeH = windowEl.dataset.savedResizeH;
            if (savedResizeH) {
                windowEl.style.height = savedResizeH;
                windowEl.classList.add('yawo-window-resized');
                delete windowEl.dataset.savedResizeH;
            }
            contentEl.style.display   = '';
            contentEl.style.height    = '0';
            contentEl.style.overflowY = 'hidden';
            windowEl.style.minWidth   = '';
            const targetHeight = contentEl.scrollHeight;
            contentEl.style.overflowY = '';
            contentEl.style.height    = targetHeight + 'px';
            contentEl.addEventListener('transitionend', function handler() {
                contentEl.style.height = '';
                btn.disabled = false;
                btn.style.textDecoration = '';
                contentEl.removeEventListener('transitionend', handler);
            });
            // The chevron glyph is an SVG; CSS rotates it based on buttonStatus.
            btn.dataset.buttonStatus = 'expanded';
            btn.ariaLabel = `Minimize window "${label}"`;
        }
    }

    enableDragging(windowSelector, handleSelector, onDragStop = null) {
        const windowEl = document.querySelector(windowSelector);
        const handleEl = document.querySelector(handleSelector);
        if (!windowEl || !handleEl) {
            this.setError(`Can not drag! ${windowEl ? '' : windowSelector} ${windowEl || handleEl ? '' : 'and '}${handleEl ? '' : handleSelector} was not found!`);
            return;
        }
        const CLICK_THRESHOLD = 5; // px tolerance to distinguish a click from a drag
        let startOffsetX, isDragging = false, animFrame = null;
        let prevX = 0, prevY = 0, targetX = 0, targetY = 0, startOffsetY = 0;
        let boundingRect = null;
        let startClientX = 0, startClientY = 0, moved = false, downTarget = null;

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

        const startDrag = (clientX, clientY, target) => {
            isDragging    = true;
            moved         = false;
            downTarget    = target;
            startClientX  = clientX;
            startClientY  = clientY;
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
            handleEl.classList.add('yawo-dragging');
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
            handleEl.classList.remove('yawo-dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('mouseup',   stopDrag);
            document.removeEventListener('touchend',  stopDrag);
            document.removeEventListener('touchcancel', stopDrag);
            if (typeof onDragStop === 'function') onDragStop(prevX, prevY);
            // A plain click (no movement) on the titlebar toggles minimize.
            // Clicks originating from an interactive control (e.g. the ▼ button) are
            // ignored to avoid a double-toggle with their own handler.
            if (!moved && downTarget && !downTarget.closest('button, a, input, textarea, select')) {
                const minBtn = handleEl.querySelector('[data-button-status="expanded"], [data-button-status="collapsed"]');
                if (minBtn) this.toggleMinimize(minBtn);
            }
        };

        const onMouseMove = e => {
            if (isDragging && boundingRect) {
                targetX = e.clientX - startOffsetX; targetY = e.clientY - startOffsetY;
                if (Math.hypot(e.clientX - startClientX, e.clientY - startClientY) > CLICK_THRESHOLD) moved = true;
            }
        };

        const onTouchMove = e => {
            if (isDragging && boundingRect) {
                const touch = e.touches[0];
                if (!touch) return;
                targetX = touch.clientX - startOffsetX;
                targetY = touch.clientY - startOffsetY;
                if (Math.hypot(touch.clientX - startClientX, touch.clientY - startClientY) > CLICK_THRESHOLD) moved = true;
                e.preventDefault();
            }
        };

        handleEl.addEventListener('mousedown', e => { e.preventDefault(); startDrag(e.clientX, e.clientY, e.target); });
        handleEl.addEventListener('touchstart', e => {
            const touch = e?.touches?.[0];
            if (touch) { startDrag(touch.clientX, touch.clientY, e.target); e.preventDefault(); }
        }, { passive: false });
    }

    enableResizing(windowSelector, onResizeStop = null, savedSize = null) {
        const MIN_W = 220, MIN_H = 100;
        const windowEl = document.querySelector(windowSelector);
        if (!windowEl) {
            this.setError(`Can not resize! ${windowSelector} not found!`);
            return;
        }

        if (savedSize?.w !== undefined && savedSize?.h !== undefined) {
            windowEl.style.width  = savedSize.w + 'px';
            windowEl.style.height = savedSize.h + 'px';
            windowEl.classList.add('yawo-window-resized');
        }

        const handleEl = document.createElement('div');
        handleEl.className = 'yawo-resize-handle';
        windowEl.appendChild(handleEl);

        let isResizing = false, animFrame = null;
        let startX, startY, startW, startH, targetW, targetH, prevW, prevH;

        const tick = () => {
            if (isResizing) {
                if (Math.abs(prevW - targetW) > 0.5 || Math.abs(prevH - targetH) > 0.5) {
                    prevW = targetW; prevH = targetH;
                    windowEl.style.width  = prevW + 'px';
                    windowEl.style.height = prevH + 'px';
                    windowEl.classList.add('yawo-window-resized');
                }
                animFrame = requestAnimationFrame(tick);
            }
        };

        const startResize = (clientX, clientY) => {
            isResizing = true;
            const rect = windowEl.getBoundingClientRect();
            startX = clientX; startY = clientY;
            startW = rect.width; startH = rect.height;
            prevW = startW; prevH = startH; targetW = startW; targetH = startH;
            windowEl.style.right = '';
            document.body.style.userSelect = 'none';
            handleEl.classList.add('yawo-resizing');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('mouseup',   stopResize);
            document.addEventListener('touchend',  stopResize);
            document.addEventListener('touchcancel', stopResize);
            if (animFrame) cancelAnimationFrame(animFrame);
            tick();
        };

        const stopResize = () => {
            isResizing = false;
            if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
            document.body.style.userSelect = '';
            handleEl.classList.remove('yawo-resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('mouseup',   stopResize);
            document.removeEventListener('touchend',  stopResize);
            document.removeEventListener('touchcancel', stopResize);
            if (typeof onResizeStop === 'function') onResizeStop(prevW, prevH);
        };

        const onMouseMove = e => {
            if (isResizing) {
                targetW = Math.max(MIN_W, startW + (e.clientX - startX));
                targetH = Math.max(MIN_H, startH + (e.clientY - startY));
            }
        };

        const onTouchMove = e => {
            if (!isResizing) return;
            const t = e.touches[0]; if (!t) return;
            targetW = Math.max(MIN_W, startW + (t.clientX - startX));
            targetH = Math.max(MIN_H, startH + (t.clientY - startY));
            e.preventDefault();
        };

        handleEl.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); startResize(e.clientX, e.clientY); });
        handleEl.addEventListener('touchstart', e => {
            const t = e?.touches?.[0]; if (!t) return;
            startResize(t.clientX, t.clientY); e.preventDefault(); e.stopPropagation();
        }, { passive: false });
    }
}
