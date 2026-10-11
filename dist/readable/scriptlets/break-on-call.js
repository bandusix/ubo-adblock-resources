// ubo-resources: name=break-on-call.js
// ubo-resources: kind=template
// ubo-resources: dependencies=proxy-apply.fn

function breakOnCall(target) {
    proxyApplyFn(target, function(context) {
        debugger;  // eslint-disable-line no-debugger
        return context.reflect();
    });
}