// ubo-resources: name=call-nothrow.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn

function callNothrow(
    chain = ''
) {
    if ( typeof chain !== 'string' ) { return; }
    if ( chain === '' ) { return; }
    const safe = safeSelf();
    const parts = safe.String_split.call(chain, '.');
    let owner = window, prop;
    for (;;) {
        prop = parts.shift();
        if ( parts.length === 0 ) { break; }
        owner = owner[prop];
        if ( owner instanceof Object === false ) { return; }
    }
    if ( prop === '' ) { return; }
    const fn = owner[prop];
    if ( typeof fn !== 'function' ) { return; }
    owner[prop] = new Proxy(fn, {
        apply: function(...args) {
            let r;
            try {
                r = Reflect.apply(...args);
            } catch {
            }
            return r;
        },
    });
}