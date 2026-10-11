// ubo-resources: name=trusted-json-edit.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit.fn
// ubo-resources: permission=1

function trustedJsonEdit(jsonq = '', ...varargs) {
    jsonEditFn(true, jsonq, ...varargs);
}