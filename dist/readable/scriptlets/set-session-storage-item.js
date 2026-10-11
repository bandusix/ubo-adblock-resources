// ubo-resources: name=set-session-storage-item.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn set-local-storage-item.fn

function setSessionStorageItem(key = '', value = '', ...varargs) {
    const safe = safeSelf();
    const options = safe.parseVarargs(varargs)
    setLocalStorageItemFn('session', false, key, value, options);
}