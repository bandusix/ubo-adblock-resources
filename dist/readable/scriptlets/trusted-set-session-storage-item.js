// ubo-resources: name=trusted-set-session-storage-item.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn set-local-storage-item.fn
// ubo-resources: permission=1

function trustedSetSessionStorageItem(key = '', value = '', ...varargs) {
    const safe = safeSelf();
    const options = safe.parseVarargs(varargs)
    setLocalStorageItemFn('session', true, key, value, options);
}