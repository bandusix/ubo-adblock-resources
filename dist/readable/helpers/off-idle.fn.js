// ubo-resources: name=off-idle.fn
// ubo-resources: kind=fn/javascript

function offIdleFn(id) {
    if ( self.requestIdleCallback ) {
        return self.cancelIdleCallback(id);
    }
    return self.cancelAnimationFrame(id);
}