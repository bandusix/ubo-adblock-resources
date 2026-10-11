// ubo-resources: name=edit-this-object.fn
// ubo-resources: kind=fn/javascript
// ubo-resources: dependencies=jsonpath.fn proxy-apply.fn safe-self.fn

function editThisObjectFn(
    trusted = false,
    propChain = '',
    jsonq = '',
    order = ''
) {
    if ( propChain === '' ) { return; }
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix(
        `${trusted ? 'trusted-' : ''}edit-this-object`,
        propChain,
        jsonq
    );
    const jsonp = JSONPath.create(jsonq);
    if ( jsonp.valid === false || jsonp.value !== undefined && trusted !== true ) {
        return safe.uboLog(logPrefix, 'Bad JSONPath query');
    }
    const editObj = objBefore => {
        const objAfter = jsonp.apply(objBefore);
        if ( objAfter === undefined ) { return; }
        safe.uboLog(logPrefix, 'Edited');
        if ( safe.logLevel <= 1 ) { return; }
        safe.uboLog(logPrefix, `After edit:\n${safe.JSON_stringify(objAfter, null, 2)}`);
    };
    proxyApplyFn(propChain, function(context) {
        const { thisArg } = context;
        let r;
        if ( order === 'after' ) {
            r = context.reflect();
        }
        editObj(thisArg);
        if ( order !== 'after' ) {
            r = context.reflect();
        }
        return r;
    });
}