// ubo-resources: name=popads.js
// ubo-resources: kind=application/javascript
// ubo-resources: aliases=popads.net.js prevent-popads-net.js

(function() {
    'use strict';
    const magic = String.fromCharCode(Date.now() % 26 + 97) +
                  Math.floor(Math.random() * 982451653 + 982451653).toString(36);
    const oe = window.onerror;
    window.onerror = function(msg, src, line, col, error) {
        if ( typeof msg === 'string' && msg.indexOf(magic) !== -1 ) { return true; }
        if ( oe instanceof Function ) {
            return oe(msg, src, line, col, error);
        }
    }.bind();
    const throwMagic = function() { throw new ReferenceError(magic); };
    delete window.PopAds;
    delete window.popns;
    Object.defineProperties(window, {
        PopAds: { set: throwMagic },
        popns: { set: throwMagic }
    });
})();
