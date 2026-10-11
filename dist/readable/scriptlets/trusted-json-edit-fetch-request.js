// ubo-resources: name=trusted-json-edit-fetch-request.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-fetch-request.fn
// ubo-resources: permission=1

function trustedJsonEditFetchRequest(jsonq = '', ...args) {
    jsonEditFetchRequestFn(true, jsonq, ...args);
}