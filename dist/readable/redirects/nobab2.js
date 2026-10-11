// ubo-resources: name=nobab2.js
// ubo-resources: kind=application/javascript

(function() {
    'use strict';
    const script = document.currentScript;
    if ( script === null ) { return; }
    const src = script.src;
    if ( typeof src !== 'string' ) { return; }
    // The scriplet is meant to act ONLY when it's being used as a redirection
    // for specific domains.
    const re = new RegExp(
        '^https?://[\\w-]+\\.(' +
        [
            'adclixx\\.net',
            'adnetasia\\.com',
            'adtrackers\\.net',
            'bannertrack\\.net',
        ].join('|') +
        ')/.'
    );
    if ( re.test(src) === false ) { return; }
    window.nH7eXzOsG = 858;
})();
