// ubo-resources: name=trusted-edit-object-on-getter.js
// ubo-resources: kind=template
// ubo-resources: dependencies=edit-object-on-getter.fn
// ubo-resources: permission=1

function trustedEditObjectOnGetter(...args) {
    editObjectOnGetterFn(true, ...args);
}