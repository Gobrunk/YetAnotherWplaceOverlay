import { TemplateManager }      from './template-manager.js';
import { ApiManager }           from './api-manager.js';
import { SettingsManager }      from './settings-manager.js';
import { WindowMain }           from './windows/main.js';
import { WindowTemplateSelect } from './windows/overlays.js';
import { injectBridge }         from './bridge.js';
import { injectStyles }         from './windows/styles.js';
import { consoleLog }           from './utils.js';

const SCRIPT_NAME    = GM_info.script.name.toString();
const SCRIPT_VERSION = GM_info.script.version.toString();

injectBridge(SCRIPT_NAME);
injectStyles();

const savedSettings   = JSON.parse(GM_getValue('yawoUserSettings', '{}'));
const templateManager = new TemplateManager(SCRIPT_NAME, SCRIPT_VERSION);
const apiManager      = new ApiManager(templateManager);
const settingsManager = new SettingsManager(SCRIPT_NAME, SCRIPT_VERSION, savedSettings);
const windowMain      = new WindowMain(SCRIPT_NAME, SCRIPT_VERSION);

const windowTemplateSelect = new WindowTemplateSelect(SCRIPT_NAME, SCRIPT_VERSION);
windowTemplateSelect.setCtx(windowMain);
templateManager.windowTemplateSelect = windowTemplateSelect;

windowMain.setApiManager(apiManager);
windowMain.setSettingsManager(settingsManager);
windowTemplateSelect.setSettingsManager(settingsManager);
templateManager.setWindowMain(windowMain);
templateManager.setSettingsManager(settingsManager);

const storedTemplates = JSON.parse(GM_getValue('yawoTemplates', '{}'));
templateManager.importFromStorage(storedTemplates);
templateManager.loadFilterState(savedSettings);

apiManager.startListening(windowMain);

const initUI = () => {
    windowMain.toggle();

    new MutationObserver((mutations, observer) => {
        const colorOneEl = document.querySelector('#color-1');
        if (!colorOneEl) return;

        let moveBtnEl = document.querySelector('#yawo-move-btn');
        if (!moveBtnEl) {
            moveBtnEl = document.createElement('button');
            moveBtnEl.id        = 'yawo-move-btn';
            moveBtnEl.textContent = 'Move ↑';
            moveBtnEl.className = 'btn btn-soft';
            moveBtnEl.onclick   = function() {
                const palette   = this.parentNode.parentNode.parentNode.parentNode;
                const isMovingUp = this.textContent === 'Move ↑';
                palette.parentNode.className = palette.parentNode.className.replace(
                    isMovingUp ? 'bottom' : 'top',
                    isMovingUp ? 'top' : 'bottom'
                );
                palette.style.borderTopLeftRadius     = isMovingUp ? '0px' : 'var(--radius-box)';
                palette.style.borderTopRightRadius    = isMovingUp ? '0px' : 'var(--radius-box)';
                palette.style.borderBottomLeftRadius  = isMovingUp ? 'var(--radius-box)' : '0px';
                palette.style.borderBottomRightRadius = isMovingUp ? 'var(--radius-box)' : '0px';
                this.textContent = isMovingUp ? 'Move ↓' : 'Move ↑';
            };
            const heading = colorOneEl.parentNode.parentNode.parentNode.parentNode.querySelector('h2');
            heading?.parentNode?.appendChild(moveBtnEl);
        }
    }).observe(document.body, { childList: true, subtree: true });

    consoleLog(`%c${SCRIPT_NAME}%c (${SCRIPT_VERSION}) userscript has loaded!`, 'color: cornflowerblue;', '');
};

document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initUI)
    : initUI();
