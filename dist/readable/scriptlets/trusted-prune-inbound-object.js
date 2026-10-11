// ubo-resources: name=trusted-prune-inbound-object.js
// ubo-resources: kind=template
// ubo-resources: dependencies=object-find-owner.fn object-prune.fn safe-self.fn
// ubo-resources: permission=1

function trustedPruneInboundObject(
    entryPoint = '',
    argPos = '',
    rawPrunePaths = '',
    rawNeedlePaths = '',
    ...varargs
) {
    if ( entryPoint === '' ) { return; }
    let context = globalThis;
    let prop = entryPoint;
    for (;;) {
        const pos = prop.indexOf('.');
        if ( pos === -1 ) { break; }
        context = context[prop.slice(0, pos)];
        if ( context instanceof Object === false ) { return; }
        prop = prop.slice(pos+1);
    }
    if ( typeof context[prop] !== 'function' ) { return; }
    const argIndex = parseInt(argPos);
    if ( isNaN(argIndex) ) { return; }
    if ( argIndex < 1 ) { return; }
    const safe = safeSelf();
    const extraArgs = safe.parseVarargs(varargs);
    const needlePaths = [];
    if ( rawPrunePaths !== '' ) {
        needlePaths.push(...safe.String_split.call(rawPrunePaths, / +/));
    }
    if ( rawNeedlePaths !== '' ) {
        needlePaths.push(...safe.String_split.call(rawNeedlePaths, / +/));
    }
    const stackNeedle = safe.initPattern(extraArgs.stackToMatch || '', { canNegate: true });
    const mustProcess = root => {
        for ( const needlePath of needlePaths ) {
            if ( objectFindOwnerFn(root, needlePath) === false ) {
                return false;
            }
        }
        return true;
    };
    context[prop] = new Proxy(context[prop], {
        apply: function(target, thisArg, args) {
            const targetArg = argIndex <= args.length
                ? args[argIndex-1]
                : undefined;
            if ( targetArg instanceof Object && mustProcess(targetArg) ) {
                let objBefore = targetArg;
                if ( extraArgs.dontOverwrite ) {
                    try {
                        objBefore = safe.JSON_parse(safe.JSON_stringify(targetArg));
                    } catch {
                        objBefore = undefined;
                    }
                }
                if ( objBefore !== undefined ) {
                    const objAfter = objectPruneFn(
                        objBefore,
                        rawPrunePaths,
                        rawNeedlePaths,
                        stackNeedle,
                        extraArgs
                    );
                    args[argIndex-1] = objAfter || objBefore;
                }
            }
            return Reflect.apply(target, thisArg, args);
        },
    });
}