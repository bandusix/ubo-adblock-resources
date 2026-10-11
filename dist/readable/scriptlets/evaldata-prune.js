// ubo-resources: name=evaldata-prune.js
// ubo-resources: kind=template
// ubo-resources: dependencies=object-prune.fn proxy-apply.fn

function evaldataPrune(
    rawPrunePaths = '',
    rawNeedlePaths = ''
) {
    proxyApplyFn('eval', function(context) {
        const before = context.reflect();
        if ( typeof before !== 'object' ) { return before; }
        if ( before === null ) { return null; }
        const after = objectPruneFn(before, rawPrunePaths, rawNeedlePaths);
        return after || before;
    });
}