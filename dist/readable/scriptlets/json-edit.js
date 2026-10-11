// ubo-resources: name=json-edit.js
// ubo-resources: kind=template
// ubo-resources: dependencies=json-edit.fn

function jsonEdit(jsonq = '', ...varargs) {
    jsonEditFn(false, jsonq, ...varargs);
}