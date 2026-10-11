// ubo-resources: name=set-attr.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn set-attr.fn

function setAttr(
    selector = '',
    attr = '',
    value = '',
    ...varargs
) {
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix('set-attr', selector, attr, value);
    const validValues = [ '', 'false', 'true' ];
    if ( validValues.includes(value.toLowerCase()) === false ) {
        if ( /^\d+$/.test(value) ) {
            const n = parseInt(value, 10);
            if ( n >= 32768 ) { return; }
            value = `${n}`;
        } else if ( /^\[.+\]$/.test(value) === false ) {
            return;
        }
    }
    const options = safe.parseVarargs(varargs);
    setAttrFn(false, logPrefix, selector, attr, value, options);
}