// ubo-resources: name=trusted-prevent-xhr.js
// ubo-resources: kind=template
// ubo-resources: dependencies=prevent-xhr.fn

function trustedPreventXhr(...args) {
    preventXhrFn(true, ...args);
}