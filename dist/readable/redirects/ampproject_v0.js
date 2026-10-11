// ubo-resources: name=ampproject_v0.js
// ubo-resources: kind=application/javascript
// ubo-resources: aliases=ampproject.org/v0.js

(function() {
    'use strict';
    const head = document.head;
    if ( !head ) { return; }
    const style = document.createElement('style');
    style.textContent = [
        'body {',
        '  animation: none !important;',
        '  overflow: unset !important;',
        '}'
    ].join('\n');
    head.appendChild(style);
})();
