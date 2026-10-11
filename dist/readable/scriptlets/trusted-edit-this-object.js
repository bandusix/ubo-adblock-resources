// ubo-resources: name=trusted-edit-this-object.js
// ubo-resources: kind=template
// ubo-resources: dependencies=edit-this-object.fn
// ubo-resources: permission=1

function trustedEditThisObject(...args) {
    editThisObjectFn(true, ...args);
}