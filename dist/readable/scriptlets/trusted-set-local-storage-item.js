// ubo-resources: name=trusted-set-local-storage-item.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn set-local-storage-item.fn
// ubo-resources: permission=1

function trustedSetLocalStorageItem(key = '', value = '', ...varargs) {
    const safe = safeSelf();
    const options = safe.parseVarargs(varargs)
    setLocalStorageItemFn('local', true, key, value, options);
}