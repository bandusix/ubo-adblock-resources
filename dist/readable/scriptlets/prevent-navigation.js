// ubo-resources: name=prevent-navigation.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn

function preventNavigation(
    pattern = ''
) {
    const safe = safeSelf();
    const logPrefix = safe.makeLogPrefix('prevent-navigation', pattern);
    const needle = pattern === 'location.href' ? self.location.href : pattern;
    const matcher = safe.initPattern(needle, { canNegate: true });
    self.navigation.addEventListener('navigate', ev => {
        if ( ev.userInitiated ) { return; }
        const { url } = ev.destination;
        if ( pattern === '' ) {
            safe.uboLog(logPrefix, `Navigation to ${url}`);
            return;
        }
        if ( safe.testPattern(matcher, url) ) {
            ev.preventDefault();
            safe.uboLog(logPrefix, `Prevented navigation to ${url}`);
        }
    });
}