// ubo-resources: name=jsonl-edit-fetch-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=jsonl-edit-fetch-response.fn

function jsonlEditFetchResponse(jsonq = '', ...args) {
    jsonlEditFetchResponseFn(false, jsonq, ...args);
}