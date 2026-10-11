// ubo-resources: name=trusted-prune-outbound-object.js
// ubo-resources: kind=template
// ubo-resources: dependencies=object-prune.fn proxy-apply.fn safe-self.fn
// ubo-resources: permission=1

function trustedPruneOutboundObject(
    propChain = '',
    rawPrunePaths = '',
    rawNeedlePaths = '',
    ...varargs
) {
    if ( propChain === '' ) { return; }
    const safe = safeSelf();
    const extraArgs = safe.parseVarargs(varargs);
    proxyApplyFn(propChain, function(context) {
        const objBefore = context.reflect();
        if ( objBefore instanceof Object === false ) { return objBefore; }
        const objAfter = objectPruneFn(
            objBefore,
            rawPrunePaths,
            rawNeedlePaths,
            { matchAll: true },
            extraArgs
        );
        return objAfter || objBefore;
    });
}