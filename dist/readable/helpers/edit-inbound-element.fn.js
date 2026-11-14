// ubo-resources: name=edit-inbound-element.fn
// ubo-resources: kind=fn/javascript
// ubo-resources: dependencies=jsonpath.fn proxy-apply.fn safe-self.fn

async function editInboundElementFn(
    trusted = false,
    propChain = '',
    argPosRaw = '',
    selector = '',
    jsonq = ''
) {
    if ( propChain === '' ) { return; }
    if ( selector === '' ) { return; }
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix(
        `${trusted ? 'trusted-' : ''}edit-inbound-element`,
        propChain, argPosRaw, selector, jsonq
    );
    const jsonp = JSONPath.create(jsonq);
    if ( jsonp.valid === false || jsonp.value !== undefined && trusted !== true ) {
        return safe.uboLog(logPrefix, 'Bad JSONPath query');
    }
    const argPos = parseInt(argPosRaw, 10);
    const getElem = context => {
        if ( argPosRaw === 'this' ) { return context.thisArg; }
        const { callArgs } = context;
        if ( Array.isArray(callArgs) === false ) { return; }
        if ( isNaN(argPos) ) { return; }
        if ( argPos >= 0 ) {
            if ( callArgs.length <= argPos ) { return; }
            return callArgs[argPos];
        }
        if ( callArgs.length < -argPos ) { return; }
        return callArgs[callArgs.length + argPos];
    };
    const editElem = elem => {
        if ( elem instanceof Element === false ) { return; }
        if ( elem.matches(selector) === false ) { return; }
        elem = jsonp.apply(elem);
        if ( elem === undefined ) { return; }
        safe.uboLog(logPrefix, 'Edited');
    };
    proxyApplyFn(propChain, function(context) {
        const elem = getElem(context);
        if ( elem !== undefined ) {
            editElem(elem);
        }
        return context.reflect();
    });
}