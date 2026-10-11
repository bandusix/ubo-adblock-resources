// ubo-resources: name=trusted-json-edit-xhr-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-xhr-response.fn
// ubo-resources: permission=1

function trustedJsonEditXhrResponse(jsonq = '', ...args) {
    jsonEditXhrResponseFn(true, jsonq, ...args);
}