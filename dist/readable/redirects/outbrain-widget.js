// ubo-resources: name=outbrain-widget.js
// ubo-resources: kind=application/javascript
// ubo-resources: aliases=widgets.outbrain.com/outbrain.js

(function() {
    'use strict';
    const noopfn = function() {
    };
    const obr = {};
    const methods = [
        'callClick',
        'callLoadMore',
        'callRecs',
        'callUserZapping',
        'callWhatIs',
        'cancelRecommendation',
        'cancelRecs',
        'closeCard',
        'closeModal',
        'closeTbx',
        'errorInjectionHandler',
        'getCountOfRecs',
        'getStat',
        'imageError',
        'manualVideoClicked',
        'onOdbReturn',
        'onVideoClick',
        'pagerLoad',
        'recClicked',
        'refreshSpecificWidget',
        'renderSpaWidgets',
        'refreshWidget',
        'reloadWidget',
        'researchWidget',
        'returnedError',
        'returnedHtmlData',
        'returnedIrdData',
        'returnedJsonData',
        'scrollLoad',
        'showDescription',
        'showRecInIframe',
        'userZappingMessage',
        'zappingFormAction'
    ];
    obr.extern = {
        video: {
            getVideoRecs: noopfn,
            videoClicked: noopfn
        }
    };
    methods.forEach(function(a) {
        obr.extern[a] = noopfn;
    });
    window.OBR = window.OBR || obr;
})();
