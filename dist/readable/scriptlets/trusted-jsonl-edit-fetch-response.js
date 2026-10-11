// ubo-resources: name=trusted-jsonl-edit-fetch-response.js
// ubo-resources: kind=template
// ubo-resources: dependencies=jsonl-edit-fetch-response.fn
// ubo-resources: permission=1

function trustedJsonlEditFetchResponse(jsonq = '', ...args) {
    jsonlEditFetchResponseFn(true, jsonq, ...args);
}