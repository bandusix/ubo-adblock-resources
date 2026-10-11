// ubo-resources: name=trusted-json-edit-fetch-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-fetch-response.fn
// ubo-resources: permission=1

function trustedJsonEditFetchResponse(jsonq = '', ...args) {
    jsonEditFetchResponseFn(true, jsonq, ...args);
}