// ubo-resources: name=json-edit-fetch-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-fetch-response.fn

function jsonEditFetchResponse(jsonq = '', ...args) {
    jsonEditFetchResponseFn(false, jsonq, ...args);
}