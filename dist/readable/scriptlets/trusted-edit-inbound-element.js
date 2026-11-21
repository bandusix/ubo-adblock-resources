// ubo-resources: name=trusted-edit-inbound-element.js
// ubo-resources: kind=template
// ubo-resources: dependencies=edit-inbound-element.fn
// ubo-resources: permission=1

function trustedEditInboundElement(...args) {
    editInboundElementFn(true, ...args);
}