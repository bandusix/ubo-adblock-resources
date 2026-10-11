// ubo-resources: name=replace-node-text.fn
// ubo-resources: kind=fn/javascript
// ubo-resources: dependencies=get-random-token.fn run-at.fn safe-self.fn

function replaceNodeTextFn(
    nodeName = '',
    pattern = '',
    replacement = '',
    ...varargs
) {
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix('replace-node-text.fn', ...Array.from(arguments));
    const reNodeName = safe.patternToRegex(nodeName, 'i', true);
    const rePattern = safe.patternToRegex(pattern, 'gms');
    const extraArgs = safe.parseVarargs(varargs);
    const reIncludes = extraArgs.includes || extraArgs.condition
        ? safe.patternToRegex(extraArgs.includes || extraArgs.condition, 'ms')
        : null;
    const reExcludes = extraArgs.excludes
        ? safe.patternToRegex(extraArgs.excludes, 'ms')
        : null;
    const textContentFactory = (( ) => {
        const out = { createScript: s => s };
        const { trustedTypes: tt } = self;
        if ( tt instanceof Object ) {
            if ( typeof tt.getPropertyType === 'function' ) {
                if ( tt.getPropertyType('script', 'textContent') === 'TrustedScript' ) {
                    return tt.createPolicy(getRandomTokenFn(), out);
                }
            }
        }
        return out;
    })();
    let sedCount = extraArgs.sedCount ?? Number.MAX_SAFE_INTEGER;
    const handleNode = node => {
        const before = node.textContent;
        if ( reIncludes ) {
            reIncludes.lastIndex = 0;
            if ( safe.RegExp_test(reIncludes, before) === false ) { return; }
        }
        if ( reExcludes ) {
            reExcludes.lastIndex = 0;
            if ( safe.RegExp_test(reExcludes, before) ) { return; }
        }
        rePattern.lastIndex = 0;
        if ( safe.RegExp_test(rePattern, before) === false ) { return; }
        rePattern.lastIndex = 0;
        const after = pattern !== ''
            ? before.replace(rePattern, replacement)
            : replacement;
        node.textContent = node.nodeName === 'SCRIPT'
            ? textContentFactory.createScript(after)
            : after;
        if ( safe.logLevel > 1 ) {
            safe.uboLog(logPrefix, `Text before:\n${before.trim()}`);
        }
        safe.uboLog(logPrefix, `Text after:\n${after.trim()}`);
        sedCount -= 1;
    };
    const handleTree = root => {
        const treeWalker = document.createTreeWalker(root,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
        );
        const { currentScript } = document;
        let count = 0;
        for (;;) {
            const node = treeWalker.nextNode();
            if ( node === null ) { break; }
            count += 1;
            if ( node === currentScript ) { continue; }
            if ( reNodeName.test(node.nodeName) ) {
                handleNode(node);
            } else if ( node.nodeName === 'TEMPLATE' ) {
                count += handleTree(node.content);
            } else {
                continue;
            }
            if ( sedCount === 0 ) { break; }
        }
        return count;
    };
    if ( document.documentElement ) {
        const count = handleTree(document.documentElement);
        safe.uboLog(logPrefix, `${count} nodes present before installing mutation observer`);
    }
    const stay = Boolean(extraArgs.stay);
    if ( sedCount === 0 && stay === false ) { return; }
    const stop = (takeRecord = true) => {
        const mutations = takeRecord ? observer.takeRecords() : [];
        observer.disconnect();
        handleMutations(mutations);
        if ( safe.logLevel > 1 ) {
            safe.uboLog(logPrefix, 'Quitting');
        }
    };
    const handleMutations = mutations => {
        for ( const mutation of mutations ) {
            for ( const node of mutation.addedNodes ) {
                if ( reNodeName.test(node.nodeName) ) {
                    handleNode(node);
                } else if ( node.nodeName === 'TEMPLATE' ) {
                    handleTree(node.content);
                } else {
                    continue;
                }
                if ( sedCount === 0 ) { return stop(false); }
            }
        }
    };
    const observer = new MutationObserver(handleMutations);
    observer.observe(document, { childList: true, subtree: true });
    if ( stay ) { return; }
    runAt(( ) => {
        const quitAfter = extraArgs.quitAfter ?? 0;
        if ( quitAfter === 0 ) { return stop(); }
        setTimeout(( ) => { stop(); }, quitAfter);
    }, 'interactive');
}