// ubo-resources: name=amazon_apstag.js
// ubo-resources: kind=application/javascript

// https://www.reddit.com/r/uBlockOrigin/comments/ghjqph/
// https://github.com/NanoMeow/QuickReports/issues/3717
// https://www.reddit.com/r/uBlockOrigin/comments/qyx7en/

// https://searchfox.org/mozilla-central/source/browser/extensions/webcompat/shims/apstag.js
//   Import queue-related initialization code.

(function() {
    'use strict';
    const w = window;
    const noopfn = function() {
        ; // jshint ignore:line
    }.bind();
    const _Q = w.apstag && w.apstag._Q || [];
    const apstag = {
        _Q,
        fetchBids: function(a, b) {
            if ( typeof b === 'function' ) {
                b([]);
            }
        },
        init: noopfn,
        setDisplayBids: noopfn,
        targetingKeys: noopfn,
    };
    w.apstag = apstag;
    _Q.push = function(prefix, args) {
        try {
            switch (prefix) {
            case 'f':
                apstag.fetchBids(...args);
                break;
            }
        } catch (e) {
            console.trace(e);
        }
    };
    for ( const cmd of _Q ) {
        _Q.push(cmd);
    }
})();
