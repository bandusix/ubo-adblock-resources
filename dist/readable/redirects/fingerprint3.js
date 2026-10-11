// ubo-resources: name=fingerprint3.js
// ubo-resources: kind=application/javascript

(function() {
    'use strict';
    const visitorId = (( ) => {
        let id = '';
        for ( let i = 0; i < 8; i++ ) {
            id += (Math.random() * 0x10000 + 0x1000 | 0).toString(16).slice(-4);
        }
        return id;
    })();
    const FingerprintJS = class {
        static hashComponents() {
            return visitorId;
        }
        static load() {
            return Promise.resolve(new FingerprintJS());
        }
        get() {
            return Promise.resolve({
                visitorId,
            });
        }
    };
    window.FingerprintJS = FingerprintJS;
})();
