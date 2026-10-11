// ubo-resources: name=prevent-fetch.js
// ubo-resources: kind=template
// ubo-resources: aliases=no-fetch-if.js
// ubo-resources: dependencies=prevent-fetch.fn

function preventFetch(...args) {
    preventFetchFn(false, ...args);
}