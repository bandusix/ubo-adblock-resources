/* GNU General Public License ... version 3 ... either version 3 of the License, or (at your option) any later version. */

import { registerScriptlet } from './base.js';

// Externally added to the private namespace in which scriptlets execute.
/* global scriptletGlobals */

export function safeSelf() {
    if ( safeSelf.safe ) {
        return safeSelf.safe;
    }
    const self = globalThis;
    const safe = {
        'Object_defineProperty': Object.defineProperty.bind(Object),
        'log': console.log.bind(console),
        makeLogPrefix(...args) {
            return this.sendToLogger && `[${args.join(' ⁝ ')}]` || '';
        },
        escapeRegexChars(s) {
            return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },
        patternToRegex(pattern, flags = undefined) {
            const match = /^\/(.+)\/([gimsu]*)$/.exec(pattern);
            if ( match === null ) { return new RegExp(this.escapeRegexChars(pattern), flags); }
            return new RegExp(match[1], match[2] || undefined);
        },
    };
    safeSelf.safe = safe;
    if ( scriptletGlobals.bcSecret === undefined ) { return safe; }
    return safe;
}
registerScriptlet(safeSelf, {
    name: 'safe-self.fn',
});
