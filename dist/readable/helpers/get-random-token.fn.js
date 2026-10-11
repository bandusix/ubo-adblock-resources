// ubo-resources: name=get-random-token.fn
// ubo-resources: kind=fn/javascript
// ubo-resources: dependencies=safe-self.fn

function getRandomTokenFn() {
    const safe = safeSelf();
    return safe.String_fromCharCode(Date.now() % 26 + 97) +
        safe.Math_floor(safe.Math_random() * 982451653 + 982451653).toString(36);
}