// ubo-resources: name=json-edit-xhr-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-xhr-response.fn

function jsonEditXhrResponse(jsonq = '', ...args) {
    jsonEditXhrResponseFn(false, jsonq, ...args);
}