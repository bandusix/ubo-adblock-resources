// ubo-resources: name=trusted-edit-element-object.js
// ubo-resources: kind=template
// ubo-resources: dependencies=edit-element-object.fn
// ubo-resources: permission=1

function trustedEditElementObject(...args) {
    editElementObjectFn(true, ...args);
}