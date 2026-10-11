import { registerScriptlet } from './base.js';
import { safeSelf } from './safe-self.js';

/******************************************************************************/

export function getRandomTokenFn() {
    const safe = safeSelf();
    return safe.String_fromCharCode(Date.now() % 26 + 97) +
        safe.Math_floor(safe.Math_random() * 982451653 + 982451653).toString(36);
}
registerScriptlet(getRandomTokenFn, {
    name: 'get-random-token.fn',
    dependencies: [
        safeSelf,
    ],
});

export function getExceptionTokenFn() {
    const token = getRandomTokenFn();
    const oe = self.onerror;
    self.onerror = function(msg, ...args) {
        if ( typeof msg === 'string' && msg.includes(token) ) { return true; }
        if ( oe instanceof Function ) { return oe.call(this, msg, ...args); }
    }.bind();
    return token;
}
registerScriptlet(getExceptionTokenFn, {
    name: 'get-exception-token.fn',
    dependencies: [
        getRandomTokenFn,
    ],
});

// Defined and registered, but with a template literal holding `}` and a nested template: lexer stress.
export function onIdleFn(fn, options) {
    const label = `idle:${ `${options && options.timeout}` }}`;
    if ( self.requestIdleCallback ) { return self.requestIdleCallback(fn, options); }
    return self.setTimeout(fn, 1) + label.length;
}
registerScriptlet(onIdleFn, {
    name: 'on-idle.fn',
});
