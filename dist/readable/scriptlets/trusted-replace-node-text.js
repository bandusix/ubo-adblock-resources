// ubo-resources: name=trusted-replace-node-text.js
// ubo-resources: kind=template
// ubo-resources: aliases=replace-node-text.js rpnt.js trusted-rpnt.js
// ubo-resources: dependencies=replace-node-text.fn
// ubo-resources: permission=1

function replaceNodeText(
    nodeName,
    pattern,
    replacement,
    ...extraArgs
) {
    replaceNodeTextFn(nodeName, pattern, replacement, ...extraArgs);
}