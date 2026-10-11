// ubo-resources: name=set-constant.js
// ubo-resources: kind=template
// ubo-resources: aliases=set.js
// ubo-resources: dependencies=set-constant.fn

function setConstant(
    ...args
) {
    setConstantFn(false, ...args);
}