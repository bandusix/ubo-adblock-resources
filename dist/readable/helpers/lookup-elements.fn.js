// ubo-resources: name=lookup-elements.fn
// ubo-resources: kind=fn/javascript
// ubo-resources: dependencies=off-idle.fn on-idle.fn

function lookupElementsFn(directive, until = 0) {
    if ( lookupElementsFn.querySelectorEx === undefined ) {
        lookupElementsFn.getShadowRoot = elem => {
            if ( elem.openOrClosedShadowRoot ) { // Firefox
                return elem.openOrClosedShadowRoot;
            }
            if ( self.chrome?.dom?.openOrClosedShadowRoot ) { // Chromium
                return self.chrome.dom.openOrClosedShadowRoot(elem);
            }
            return elem.shadowRoot;
        };
        lookupElementsFn.queryOrEvaluateSelector = (selector, context) => {
            if ( selector.startsWith('xpath:') === false ) {
                return Array.from(context.querySelectorAll(selector));
            }
            const result = document.evaluate(selector.slice(6), context, null, 7, null);
            const out = [];
            if ( result.resultType === 7 ) {
                for ( let i = 0; i < result.snapshotLength; i++ ) {
                    out[i] = result.snapshotItem(i);
                }
            }
            return out;
        }
        lookupElementsFn.querySelectorEx = (selector, context = document) => {
            const pos = selector.indexOf(' >>> ');
            if ( pos === -1 ) {
                return lookupElementsFn.queryOrEvaluateSelector(selector, context);
            }
            const outside = selector.slice(0, pos).trim();
            const inside = selector.slice(pos + 5).trim();
            const elems = lookupElementsFn.queryOrEvaluateSelector(outside, context);
            const out = [];
            for ( let i = 0; i < elems.length; i++ ) {
                const shadowRoot = lookupElementsFn.getShadowRoot(elems[i]);
                if ( Boolean(shadowRoot) === false ) { continue; }
                lookupElementsFn.querySelectorEx(inside, shadowRoot).forEach(a => out.push(a));
            }
            return out;
        };
        lookupElementsFn.lookup = directive => {
            const beVisible = directive.startsWith('when-visible:');
            const selector = beVisible ? directive.slice(13) : directive;
            const elems = lookupElementsFn.querySelectorEx(selector);
            if ( beVisible !== true ) { return elems; }
            return elems.filter(a => a.checkVisibility({
                opacityProperty: true,
                visibilityProperty: true,
            }));
        };
        lookupElementsFn.lookupAsync = details => {
            const elems = lookupElementsFn.lookup(details.directive);
            if ( elems.length || Date.now() >= details.until ) {
                if ( details.observer ) {
                    details.observer.disconnect();
                    details.observer = undefined;
                }
                if ( details.timer ) {
                    offIdleFn(details.timer);
                    details.timer = undefined;
                }
                return details.resolve(elems);
            }
            if ( details.observer === undefined ) {
                details.observer = new MutationObserver(( ) => {
                    lookupElementsFn.lookupAsync(details);
                });
                details.observer.observe(document, {
                    attributes: true,
                    childList: true,
                    subtree: true,
                });
            }
            if ( details.timer === undefined ) {
                details.timer = onIdleFn(( ) => {
                    details.timer = undefined;
                    lookupElementsFn.lookupAsync(details);
                }, { timeout: 151 });
            }
        };
    }
    if ( until === 0 ) {
        return lookupElementsFn.lookup(directive);
    }
    return new Promise(resolve => {
        lookupElementsFn.lookupAsync({ directive, until, resolve });
    });
}