// ubo-resources: name=trusted-edit-object-on-setter.js
// ubo-resources: kind=template
// ubo-resources: dependencies=edit-object-on-setter.fn
// ubo-resources: permission=1

function trustedEditObjectOnSetter(...args) {
    editObjectOnSetterFn(true, ...args);
}