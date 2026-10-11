// ubo-resources: name=json-edit-xhr-request.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-xhr-request.fn

function jsonEditXhrRequest(jsonq = '', ...args) {
    jsonEditXhrRequestFn(false, jsonq, ...args);
}