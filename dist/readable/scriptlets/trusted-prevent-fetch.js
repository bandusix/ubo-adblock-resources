// ubo-resources: name=trusted-prevent-fetch.js
// ubo-resources: kind=template
// ubo-resources: dependencies=prevent-fetch.fn
// ubo-resources: permission=1

function trustedPreventFetch(...args) {
    preventFetchFn(true, ...args);
}