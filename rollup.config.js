const BANNER = `// ==UserScript==
// @name            Yet Another Wplace Overlay
// @name:en         Yet Another Wplace Overlay
// @version         0.1.0
// @description     A userscript to enhance the user experience on Wplace.live. This includes, but is not limited to: uploading images to display locally on a canvas, adding a button to move the Wplace color palette menu, and other QoL features.
// @description:en  A userscript to enhance the user experience on Wplace.live. This includes, but is not limited to: uploading images to display locally on a canvas, adding a button to move the Wplace color palette menu, and other QoL features.
// @author          Gobrunk
// @license         MPL-2.0
// @match           https://wplace.live/*
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

export default {
    input: 'src/main.js',
    output: {
        file:   'tampermonkey.js',
        format: 'iife',
        banner: BANNER,
        generatedCode: { arrowFunctions: true, constBindings: true },
    },
};
