// ubo-resources: name=remove-node-text.js
// ubo-resources: kind=template
// ubo-resources: aliases=rmnt.js
// ubo-resources: dependencies=replace-node-text.fn

function removeNodeText(
    nodeName,
    includes,
    ...extraArgs
) {
    replaceNodeTextFn(nodeName, '', '', 'includes', includes || '', ...extraArgs);
}