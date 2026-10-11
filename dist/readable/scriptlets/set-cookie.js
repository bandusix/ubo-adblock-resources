// ubo-resources: name=set-cookie.js
// ubo-resources: kind=template
// ubo-resources: dependencies=get-safe-cookie-values.fn safe-self.fn set-cookie.fn

function setCookie(
    name = '',
    value = '',
    path = '',
    ...varargs
) {
    if ( name === '' ) { return; }
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix('set-cookie', name, value, path);
    const normalized = value.toLowerCase();
    const match = /^("?)(.+)\1$/.exec(normalized);
    const unquoted = match && match[2] || normalized;
    const validValues = getSafeCookieValuesFn();
    if ( validValues.includes(unquoted) === false ) {
        if ( /^-?\d+$/.test(unquoted) === false ) { return; }
        const n = parseInt(value, 10) || 0;
        if ( n < -32767 || n > 32767 ) { return; }
    }

    const done = setCookieFn(
        false,
        name,
        value,
        '',
        path,
        safe.parseVarargs(varargs)
    );

    if ( done ) {
        safe.uboLog(logPrefix, 'Done');
    }
}