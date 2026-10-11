// ubo-resources: name=trusted-set-attr.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn set-attr.fn
// ubo-resources: permission=1

function trustedSetAttr(
    selector = '',
    attr = '',
    value = '',
    ...varargs
) {
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix('trusted-set-attr', selector, attr, value);
    const options = safe.parseVarargs(varargs);
    setAttrFn(true, logPrefix, selector, attr, value, options);
}