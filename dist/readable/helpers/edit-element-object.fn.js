// ubo-resources: name=edit-element-object.fn
// ubo-resources: kind=fn/javascript
// ubo-resources: dependencies=jsonpath.fn lookup-elements.fn safe-self.fn sleep.fn

async function editElementObjectFn(
    trusted = false,
    selector = '',
    jsonq = '',
    timeout = ''
) {
    if ( selector === '' ) { return; }
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix(
        `${trusted ? 'trusted-' : ''}edit-element-object`,
        selector, jsonq, timeout
    );
    const jsonp = JSONPath.create(jsonq);
    if ( jsonp.valid === false || jsonp.value !== undefined && trusted !== true ) {
        return safe.uboLog(logPrefix, 'Bad JSONPath query');
    }
    const process = elems => {
        for ( const elem of elems ) {
            const r = jsonp.apply(elem);
            if ( r === undefined ) { continue; }
            safe.uboLog(logPrefix, 'Edited');
        }
    };
    const until = timeout !== '' ? Date.now() + parseInt(timeout, 10) : 0;
    do {
        const r = lookupElementsFn(selector, until);
        if ( Array.isArray(r) ) {
            process(r);
        } else if ( r instanceof Promise ) {
            const elems = await r;
            process(elems);
        }
        await sleepFn();
    } while ( Date.now() < until );
}