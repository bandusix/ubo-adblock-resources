// ubo-resources: name=prevent-innerHTML.js
// ubo-resources: kind=template
// ubo-resources: dependencies=freeze-element-property.js

function preventInnerHTML(
    selector = '',
    pattern = ''
) {
    freezeElementProperty('innerHTML', selector, pattern);
}