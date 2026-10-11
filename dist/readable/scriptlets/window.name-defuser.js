// ubo-resources: name=window.name-defuser.js
// ubo-resources: kind=template

function windowNameDefuser() {
    if ( window === window.top ) {
        window.name = '';
    }
}