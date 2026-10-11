// ubo-resources: name=set-cookie-reload.js
// ubo-resources: kind=template
// ubo-resources: dependencies=set-cookie.js

function setCookieReload(name, value, path, ...args) {
    setCookie(name, value, path, 'reload', '1', ...args);
}