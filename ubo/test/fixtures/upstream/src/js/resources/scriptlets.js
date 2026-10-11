/* fixture: shaped like uBlock Origin's resources/scriptlets.js */

import './aopr.js';
import './trusted.js';

import {
    onIdleFn,
} from './utils.js';

import { registeredScriptlets } from './base.js';

export const builtinScriptlets = registeredScriptlets;

// Registered with `builtinScriptlets.push` BEFORE the function is declared (hoisting), like most of upstream's file.
builtinScriptlets.push({
    name: 'remove-class.js',
    aliases: [
        'rc.js',
    ],
    fn: removeClass,
    dependencies: [
        'on-idle.fn',
        'safe-self.fn',
    ],
    world: 'ISOLATED',
});
function removeClass(
    rawToken = '',
    rawSelector = '',
    behavior = ''
) {
    if ( typeof rawToken !== 'string' ) { return; }
    const safe = safeSelf();
    const tokens = safe.String_split.call(rawToken, /\s*\|\s*/);
    const selector = tokens
        .map(a => `${rawSelector}.${CSS.escape(a)}`)
        .join(',');
    const re = /["'}]/;
    onIdleFn(() => { document.querySelectorAll(selector).forEach(e => e.classList.remove(...tokens)); re.test(behavior); });
}

builtinScriptlets.push({
    name: 'noop-scriptlet.js',
    fn: noopScriptlet,
});
function noopScriptlet() {
}
