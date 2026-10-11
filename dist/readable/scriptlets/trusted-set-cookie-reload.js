// ubo-resources: name=trusted-set-cookie-reload.js
// ubo-resources: kind=template
// ubo-resources: dependencies=trusted-set-cookie.js
// ubo-resources: permission=1

function trustedSetCookieReload(name, value, offsetExpiresSec, path, ...args) {
    trustedSetCookie(name, value, offsetExpiresSec, path, 'reload', '1', ...args);
}