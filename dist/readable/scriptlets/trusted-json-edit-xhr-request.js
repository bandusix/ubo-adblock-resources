// ubo-resources: name=trusted-json-edit-xhr-request.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-xhr-request.fn
// ubo-resources: permission=1

function trustedJsonEditXhrRequest(jsonq = '', ...args) {
    jsonEditXhrRequestFn(true, jsonq, ...args);
}