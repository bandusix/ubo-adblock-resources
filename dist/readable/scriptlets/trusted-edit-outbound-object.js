// ubo-resources: name=trusted-edit-outbound-object.js
// ubo-resources: kind=template
// ubo-resources: dependencies=edit-outbound-object.fn
// ubo-resources: permission=1

function trustedEditOutboundObject(propChain = '', jsonq = '') {
    editOutboundObjectFn(true, propChain, jsonq);
}