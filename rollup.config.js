import terser from '@rollup/plugin-terser';

const BANNER = `// ==UserScript==
// @name            Yet Another Wplace Overlay
// @name:en         Yet Another Wplace Overlay
// @version         1.17.1
// @description     A userscript to enhance the user experience on Wplace.live. This includes, but is not limited to: uploading images to display locally on a canvas, adding a button to move the Wplace color palette menu, and other QoL features.
// @description:en  A userscript to enhance the user experience on Wplace.live. This includes, but is not limited to: uploading images to display locally on a canvas, adding a button to move the Wplace color palette menu, and other QoL features.
// @author          Gobrunk
// @license         MPL-2.0
// @match           https://wplace.live/*
// @updateURL       https://raw.githubusercontent.com/Gobrunk/YetAnotherWplaceOverlay/refs/heads/master/tampermonkey.js
// @downloadURL     https://raw.githubusercontent.com/Gobrunk/YetAnotherWplaceOverlay/refs/heads/master/tampermonkey.js
// @grant           GM_addStyle
// @grant           GM.setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @grant           GM.download
// @noframes
// @run-at          document-start
// ==/UserScript==

// Wplace  --> https://wplace.live
// License --> https://www.mozilla.org/en-US/MPL/2.0/`;

const addBanner = {
    name: 'add-banner',
    generateBundle(_, bundle) {
        for (const chunk of Object.values(bundle)) {
            if (chunk.type === 'chunk') chunk.code = BANNER + '\n' + chunk.code;
        }
    },
};

// Lets `.css` files be imported as plain strings, so stylesheets can live as
// standalone files (front/style/*.css) yet still ship inside the userscript.
const cssAsString = {
    name: 'css-as-string',
    transform(code, id) {
        if (!id.endsWith('.css')) return null;
        return { code: `export default ${JSON.stringify(code)};`, map: { mappings: '' } };
    },
};

export default {
    input: 'src/main.js',
    output: {
        file:   'tampermonkey.js',
        format: 'iife',
        generatedCode: { arrowFunctions: true, constBindings: true },
    },
    plugins: [cssAsString, terser(), addBanner],
};
