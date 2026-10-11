// ubo-resources: name=sleep.fn
// ubo-resources: kind=fn/javascript

function sleepFn(ms = 0) {
    const nap = ( ) => {
        return new Promise(resolve => {
            self.requestAnimationFrame(resolve);
        });
    }
    const until = Date.now() + ms;
    const sleep = async resolve => {
        do {
            await nap();
        } while ( Date.now() < until );
        resolve();
    };
    return new Promise(resolve => { sleep(resolve); });
}