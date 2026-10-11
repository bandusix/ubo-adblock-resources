// ubo-resources: name=google-analytics_cx_api.js
// ubo-resources: kind=application/javascript
// ubo-resources: aliases=google-analytics.com/cx/api.js

(function() {
    'use strict';
    const noopfn = function() {
    };
    window.cxApi = {
        chooseVariation: function() {
            return 0;
        },
        getChosenVariation: noopfn,
        setAllowHash: noopfn,
        setChosenVariation: noopfn,
        setCookiePath: noopfn,
        setDomainName: noopfn
        };
})();
