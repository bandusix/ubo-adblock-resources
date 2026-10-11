// ubo-resources: name=jsonl-edit-xhr-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=jsonl-edit-xhr-response.fn

function jsonlEditXhrResponse(jsonq = '', ...args) {
    jsonlEditXhrResponseFn(false, jsonq, ...args);
}