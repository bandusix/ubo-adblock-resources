// ubo-resources: name=trusted-edit-inbound-object.js
// ubo-resources: kind=template
// ubo-resources: dependencies=edit-inbound-object.fn
// ubo-resources: permission=1

function trustedEditInboundObject(propChain = '', argPos = '', jsonq = '') {
    editInboundObjectFn(true, propChain, argPos, jsonq);
}