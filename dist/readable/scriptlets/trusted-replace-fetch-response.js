// ubo-resources: name=trusted-replace-fetch-response.js
// ubo-resources: kind=template
// ubo-resources: aliases=trusted-rpfr.js
// ubo-resources: dependencies=replace-fetch-response.fn
// ubo-resources: permission=1

function trustedReplaceFetchResponse(...args) {
    replaceFetchResponseFn(true, ...args);
}