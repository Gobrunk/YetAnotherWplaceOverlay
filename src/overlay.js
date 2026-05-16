export class Overlay {
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
        const contentEl = windowEl.querySelector('.bm-content');
        const heading   = contentEl?.querySelector('h1');
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
            const label = heading?.textContent ?? titlebar.querySelector('h1')?.textContent ?? '';
            if (heading) {
                const clone = heading.cloneNode(true);
                btn.nextElementSibling.appendChild(clone);
            }
            btn.textContent = '▶';
            btn.dataset.buttonStatus = 'collapsed';
            btn.ariaLabel = `Unminimize window "${label}"`;
        } else {
            const clonedHeading = btn.nextElementSibling?.querySelector('h1');
            const label         = clonedHeading?.textContent ?? titlebar.querySelector('h1')?.textContent ?? '';
            clonedHeading?.remove();
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
        let startOffsetX, isDragging = false, translateX = 0, animFrame = null;
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
