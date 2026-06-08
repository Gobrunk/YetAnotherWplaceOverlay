import commonCss   from './style/common.css';
import mainCss     from './style/main.css';
import overlaysCss from './style/overlays.css';
import filtersCss  from './style/filters.css';
import settingsCss from './style/settings.css';

export function injectStyles() {
    GM_addStyle(commonCss + mainCss + overlaysCss + filtersCss + settingsCss);

    // Display font (Space Grotesk) for titles/labels + Roboto Mono for numbers.
    // A build step may inline the faces by replacing the placeholder below;
    // otherwise we lazy-load them from Google Fonts.
    const FONT_PLACEHOLDER = 'robotoMonoInjectionPoint';
    if (FONT_PLACEHOLDER.indexOf('@font-face') + 1) {
        GM_addStyle(FONT_PLACEHOLDER);
    } else {
        const fontLinkEl = document.createElement('link');
        fontLinkEl.href  = 'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Space+Grotesk:wght@400;500;600;700&display=swap';
        fontLinkEl.rel   = 'preload';
        fontLinkEl.as    = 'style';
        fontLinkEl.onload = function() { this.onload = null; this.rel = 'stylesheet'; };
        document.head?.appendChild(fontLinkEl);
    }
}
