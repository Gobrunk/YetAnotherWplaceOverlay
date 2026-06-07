// Shared chrome builders for overlay windows.
// Pure DOM factories so they work both with the fluent Overlay builder
// (via addWindowHeader / addWindowFooter) and with manual DOM code (Filter).

// Wires onclick + a touchend that proxies to click, matching the rest of the UI.
function wireButton(btn, handler) {
    if (typeof handler !== 'function') return;
    btn.onclick    = handler;
    btn.ontouchend = () => btn.click();
}

/**
 * Build a consistent title bar.
 * opts:
 *   title         {string}                window title (rendered as an h1)
 *   onMinimize    {(btn) => void}         minimize toggle handler (button always shown)
 *   minimizeLabel {string}                aria-label for the minimize button
 *   buttons       {Array<{glyph,title,onClick,className}>}  extra chrome buttons
 *   onClose       {() => void}            if set, renders a close button
 *   closeLabel    {string}                aria-label for the close button
 */
export function buildTitlebar({ title = '', onMinimize, minimizeLabel, buttons = [], onClose, closeLabel } = {}) {
    const titlebar = document.createElement('div');
    titlebar.className = 'yawo-titlebar';

    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'yawo-chrome-btn';
    minimizeBtn.textContent = '▼';
    minimizeBtn.dataset.buttonStatus = 'expanded';
    minimizeBtn.setAttribute('aria-label', minimizeLabel ?? `Minimize window "${title}"`);
    wireButton(minimizeBtn, () => onMinimize?.(minimizeBtn));
    titlebar.appendChild(minimizeBtn);

    const titleWrap = document.createElement('div');
    titleWrap.className = 'yawo-title';
    const heading = document.createElement('h1');
    heading.className = 'yawo-title-text';
    heading.textContent = title;
    titleWrap.appendChild(heading);
    titlebar.appendChild(titleWrap);

    for (const { glyph, title: btnTitle, onClick, className } of buttons) {
        const btn = document.createElement('button');
        btn.className = className ?? 'yawo-chrome-btn';
        btn.textContent = glyph;
        if (btnTitle) btn.title = btnTitle;
        wireButton(btn, onClick);
        titlebar.appendChild(btn);
    }

    if (onClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'yawo-chrome-btn';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', closeLabel ?? `Close window "${title}"`);
        wireButton(closeBtn, onClose);
        titlebar.appendChild(closeBtn);
    }

    return titlebar;
}

/**
 * Build a consistent footer: version on the left, optional chrome actions on the right.
 * opts:
 *   version {string|number}                              version label (rendered as v{version})
 *   buttons {Array<{glyph,title,onClick,html}>}          chrome action buttons
 */
export function buildFooter({ version, buttons = [] } = {}) {
    const footer = document.createElement('div');
    footer.className = 'yawo-footer';

    const versionEl = document.createElement('span');
    versionEl.className = 'yawo-footer-version';
    if (version != null) versionEl.textContent = `v${version}`;
    footer.appendChild(versionEl);

    const actions = document.createElement('div');
    actions.className = 'yawo-footer-actions';
    for (const { glyph, html, title: btnTitle, onClick } of buttons) {
        const btn = document.createElement('button');
        btn.className = 'yawo-chrome-btn';
        if (html != null) btn.innerHTML = html;
        else btn.textContent = glyph;
        if (btnTitle) btn.title = btnTitle;
        wireButton(btn, onClick);
        actions.appendChild(btn);
    }
    footer.appendChild(actions);

    return footer;
}
