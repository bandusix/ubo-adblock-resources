// ubo-resources: name=trusted-set-constant.js
// ubo-resources: kind=template
// ubo-resources: aliases=trusted-set.js
// ubo-resources: dependencies=set-constant.fn
// ubo-resources: permission=1

function trustedSetConstant(
    ...args
) {
    setConstantFn(true, ...args);
}