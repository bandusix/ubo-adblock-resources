// ubo-resources: name=popads-dummy.js
// ubo-resources: kind=application/javascript

(function() {
    'use strict';
    delete window.PopAds;
    delete window.popns;
    Object.defineProperties(window, {
        PopAds: { value: {} },
        popns: { value: {} }
    });
})();
