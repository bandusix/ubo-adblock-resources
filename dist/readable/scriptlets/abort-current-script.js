// ubo-resources: name=abort-current-script.js
// ubo-resources: kind=template
// ubo-resources: aliases=abort-current-inline-script.js acis.js acs.js
// ubo-resources: dependencies=abort-current-script.fn run-at-html-element.fn

function abortCurrentScript(...args) {
    runAtHtmlElementFn(( ) => {
        abortCurrentScriptFn(...args);
    });
}