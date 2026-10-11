// ubo-resources: name=noeval-silent.js
// ubo-resources: kind=application/javascript
// ubo-resources: aliases=silent-noeval.js

(function() {
    'use strict';
    window.eval = new Proxy(window.eval, {          // jshint ignore: line
        apply: function() {
        }
    });
})();
