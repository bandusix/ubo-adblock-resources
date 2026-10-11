// ubo-resources: name=on-idle.fn
// ubo-resources: kind=fn/javascript

function onIdleFn(fn, options) {
    if ( self.requestIdleCallback ) {
        return self.requestIdleCallback(fn, options);
    }
    return self.requestAnimationFrame(fn);
}