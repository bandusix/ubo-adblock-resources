// ubo-resources: name=nitropay_ads.js
// ubo-resources: kind=application/javascript

(function() {
    if ( window.nitroAds ) { return; }
    const noopfn = function() {
        ;
    }.bind();
    const nitroAds = {
        createAd: noopfn,
        queue: [],
    };
    window.nitroAds = nitroAds;
})();
