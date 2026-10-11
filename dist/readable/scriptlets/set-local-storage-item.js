// ubo-resources: name=set-local-storage-item.js
// ubo-resources: kind=template
// ubo-resources: dependencies=safe-self.fn set-local-storage-item.fn

function setLocalStorageItem(key = '', value = '', ...varargs) {
    const safe = safeSelf();
    const options = safe.parseVarargs(varargs)
    setLocalStorageItemFn('local', false, key, value, options);
}