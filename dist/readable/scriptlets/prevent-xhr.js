// ubo-resources: name=prevent-xhr.js
// ubo-resources: kind=template
// ubo-resources: aliases=no-xhr-if.js
// ubo-resources: dependencies=prevent-xhr.fn

function preventXhr(...args) {
    preventXhrFn(false, ...args);
}