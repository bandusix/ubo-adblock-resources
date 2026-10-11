// ubo-resources: name=chartbeat.js
// ubo-resources: kind=application/javascript
// ubo-resources: aliases=static.chartbeat.com/chartbeat.js

(function() {
    'use strict';
    const noopfn = function() {
    };
    window.pSUPERFLY = {
        activity: noopfn,
        virtualPage: noopfn
    };
    for ( const hider of document.querySelectorAll('style[id^=chartbeat-flicker-control]') ) {
        hider.remove();
    }
})();
