// Shared chrome builders + icon set for overlay windows.
// Pure DOM/string factories so they work both with the fluent Overlay builder
// (via addWindowHeader / addWindowFooter) and with manual DOM code (Filter).

// ── Icon set ──────────────────────────────────────────────
// Lucide-style line icons. Each entry is the inner markup of an SVG; `icon()`
// wraps it with a sized <svg> that inherits color via `currentColor`.
const ICON_PATHS = {
    chevronDown:  '<polyline points="6 9 12 15 18 9"/>',
    chevronRight: '<polyline points="9 6 15 12 9 18"/>',
    minimize2:    '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
    maximize2:    '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    close:        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    refresh:      '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/>',
    bolt:         '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    droplet:      '<path d="M12 2.7c4 4.4 6 7.5 6 10.3a6 6 0 0 1-12 0c0-2.8 2-5.9 6-10.3z"/>',
    trendingUp:   '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    layers:       '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    sliders:      '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    settings:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    pencil:       '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    eye:          '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    compass:      '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    grid:         '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    mapPin:       '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    image:        '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    plus:         '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    download:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    search:       '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    sort:         '<polyline points="11 7 8 4 5 7"/><line x1="8" y1="4" x2="8" y2="20"/><polyline points="13 17 16 20 19 17"/><line x1="16" y1="4" x2="16" y2="20"/>',
    crosshair:    '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
    check:        '<polyline points="20 6 9 17 4 12"/>',
    palette:      '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.7 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-1 .8-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-4.4-4.5-8-10-8z"/>',
    info:         '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    trash:        '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    share:        '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
};

// Build an inline SVG string for the named icon. `currentColor` lets callers
// tint it via CSS `color`. Size defaults to 1em so it scales with font-size.
export function icon(name, size = '1em', extraClass = '') {
    const body = ICON_PATHS[name] ?? '';
    const cls  = `yawo-icon${extraClass ? ' ' + extraClass : ''}`;
    return `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// Drives a range input's green-fill gradient via a CSS var, keeping the thumb
// white (native `accent-color` would tint the thumb too). Call once after mount.
export function bindRange(input) {
    const update = () => {
        const min = parseFloat(input.min || '0');
        const max = parseFloat(input.max || '100');
        const pct = max > min ? ((parseFloat(input.value) - min) / (max - min)) * 100 : 0;
        input.style.setProperty('--yawo-fill', `${pct}%`);
    };
    input.addEventListener('input', update);
    update();
    return input;
}

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
 *   statusDot     {boolean}               show the green "active" dot next to the title
 *   badge         {string}                small pill rendered after the title (e.g. a count)
 *   onMinimize    {(btn) => void}         minimize toggle handler (button always shown)
 *   minimizeLabel {string}                aria-label for the minimize button
 *   buttons       {Array<{glyph,icon,title,onClick,className}>}  extra chrome buttons
 *   onCompact     {(btn) => void}         compact toggle handler (button always shown; no-op if omitted)
 *   onClose       {() => void}            if set, renders a close button
 *   closeLabel    {string}                aria-label for the close button
 */
export function buildTitlebar({ title = '', statusDot = false, badge, onMinimize, minimizeLabel, buttons = [], onCompact, onClose, closeLabel } = {}) {
    const titlebar = document.createElement('div');
    titlebar.className = 'yawo-titlebar';

    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'yawo-chrome-btn yawo-minimize-btn';
    minimizeBtn.innerHTML = icon('chevronDown');
    minimizeBtn.dataset.buttonStatus = 'expanded';
    minimizeBtn.setAttribute('aria-label', minimizeLabel ?? `Minimize window "${title}"`);
    wireButton(minimizeBtn, () => onMinimize?.(minimizeBtn));
    titlebar.appendChild(minimizeBtn);

    const titleWrap = document.createElement('div');
    titleWrap.className = 'yawo-title';
    if (statusDot) {
        const dot = document.createElement('span');
        dot.className = 'yawo-status-dot';
        titleWrap.appendChild(dot);
    }
    const heading = document.createElement('h1');
    heading.className = 'yawo-title-text';
    heading.textContent = title;
    titleWrap.appendChild(heading);
    if (badge != null) {
        const pill = document.createElement('span');
        pill.className = 'yawo-title-badge';
        pill.textContent = badge;
        titleWrap.appendChild(pill);
    }
    titlebar.appendChild(titleWrap);

    for (const { glyph, icon: iconName, title: btnTitle, onClick, className } of buttons) {
        const btn = document.createElement('button');
        btn.className = className ?? 'yawo-chrome-btn';
        if (iconName) btn.innerHTML = icon(iconName);
        else          btn.textContent = glyph;
        if (btnTitle) btn.title = btnTitle;
        wireButton(btn, onClick);
        titlebar.appendChild(btn);
    }

    // Compact toggle — always rendered for chrome consistency across windows.
    // Wired only where a handler is provided (currently the main window); a no-op
    // placeholder elsewhere.
    const compactBtn = document.createElement('button');
    compactBtn.className = 'yawo-chrome-btn yawo-compact-btn';
    compactBtn.innerHTML = icon('minimize2');
    compactBtn.dataset.compactStatus = 'normal';
    compactBtn.title = 'Compact view';
    compactBtn.setAttribute('aria-label', `Toggle compact view for window "${title}"`);
    wireButton(compactBtn, () => onCompact?.(compactBtn));
    titlebar.appendChild(compactBtn);

    if (onClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'yawo-chrome-btn';
        closeBtn.innerHTML = icon('close');
        closeBtn.setAttribute('aria-label', closeLabel ?? `Close window "${title}"`);
        wireButton(closeBtn, onClose);
        titlebar.appendChild(closeBtn);
    }

    return titlebar;
}

/**
 * Build a consistent footer: version on the left, optional chrome actions /
 * status text on the right.
 * opts:
 *   version {string|number}                              version label (rendered as v{version})
 *   note    {string}                                     small muted text on the right (e.g. "2 overlays")
 *   buttons {Array<{glyph,icon,title,onClick,html}>}     chrome action buttons
 */
export function buildFooter({ version, note, buttons = [] } = {}) {
    const footer = document.createElement('div');
    footer.className = 'yawo-footer';

    const versionEl = document.createElement('span');
    versionEl.className = 'yawo-footer-version';
    if (version != null) versionEl.textContent = `v${version}`;
    footer.appendChild(versionEl);

    const actions = document.createElement('div');
    actions.className = 'yawo-footer-actions';
    if (note != null) {
        const noteEl = document.createElement('span');
        noteEl.className = 'yawo-footer-note';
        noteEl.textContent = note;
        actions.appendChild(noteEl);
    }
    for (const { glyph, html, icon: iconName, title: btnTitle, onClick } of buttons) {
        const btn = document.createElement('button');
        btn.className = 'yawo-chrome-btn';
        if (iconName != null)    btn.innerHTML = icon(iconName);
        else if (html != null)   btn.innerHTML = html;
        else                     btn.textContent = glyph;
        if (btnTitle) btn.title = btnTitle;
        wireButton(btn, onClick);
        actions.appendChild(btn);
    }
    footer.appendChild(actions);

    return footer;
}
