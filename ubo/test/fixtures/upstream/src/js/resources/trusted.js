import { ArglistParser } from './shared.js';
import { registerScriptlet } from './base.js';
import { safeSelf } from './safe-self.js';

export function trustedSetCookie(
    name = '',
    value = ''
) {
    if ( name === '' ) { return; }
    const safe = safeSelf();
    const parser = new ArglistParser(',', true);
    parser.nextArg(value);
    document.cookie = `${name}=${value}`;
}
registerScriptlet(trustedSetCookie, {
    name: 'trusted-set-cookie.js',
    requiresTrust: true,
    world: 'ISOLATED',
    priority: 10,
    dependencies: [
        ArglistParser,
        safeSelf,
    ],
});
