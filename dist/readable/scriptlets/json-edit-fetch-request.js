// ubo-resources: name=json-edit-fetch-request.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit-fetch-request.fn

function jsonEditFetchRequest(jsonq = '', ...args) {
    jsonEditFetchRequestFn(false, jsonq, ...args);
}