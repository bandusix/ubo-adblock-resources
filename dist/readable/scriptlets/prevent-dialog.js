// ubo-resources: name=prevent-dialog.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn

function preventDialog(
    selector = '',
) {
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix('prevent-dialog', selector);
    const prevent = ( ) => {
        debouncer = undefined;
        const elems = document.querySelectorAll(`dialog${selector}`);
        for ( const elem of elems ) {
            if ( typeof elem.close !== 'function' ) { continue; }
            if ( elem.open === false ) { continue; }
            elem.close();
            safe.uboLog(logPrefix, 'Closed');
        }
    };
    let debouncer;
    const observer = new MutationObserver(( ) => {
        if ( debouncer !== undefined ) { return; }
        debouncer = requestAnimationFrame(prevent);
    });
    observer.observe(document, {
        attributes: true,
        childList: true,
        subtree: true,
    });
}