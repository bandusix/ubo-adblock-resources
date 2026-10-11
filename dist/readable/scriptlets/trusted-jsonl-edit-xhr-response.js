// ubo-resources: name=trusted-jsonl-edit-xhr-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=jsonl-edit-xhr-response.fn
// ubo-resources: permission=1

function trustedJsonlEditXhrResponse(jsonq = '', ...args) {
    jsonlEditXhrResponseFn(true, jsonq, ...args);
}