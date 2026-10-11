/* fixture: shaped like uBlock Origin's redirect-resources.js */

export default new Map([
    [ '1x1.gif', {
        alias: '1x1-transparent.gif',
        data: 'blob',
    } ],
    [ 'click2load.html', {
        params: [ 'aliasURL', 'url' ],
    } ],
    [ 'crlf.txt', {
        alias: 'nooptext',  /* trailing comment */
        data: 'text',
    } ],
    [ 'empty', {
        data: 'text',   // Important!
    } ],
    [ 'gpl-header.js', {
        alias: [
            'gpl.example.com/header.js',
            'abp-resource:gpl-header',
        ],
        data: 'text',
    } ],
    [ 'google-ima-dai.js', {
        alias: 'google-ima3-dai',
        data: 'text',
        requiresTrust: true,
    } ],
    [ 'mozilla-based.js', {
        data: 'text',
    } ],
    [ 'noop-0.1s.mp3', {
        alias: [ 'noopmp3-0.1s', 'abp-resource:blank-mp3' ],
        data: 'blob',
    } ],
    [ 'noop.html', {
        alias: 'noopframe',
    } ],
    [ 'noop.js', {
        alias: [ 'noopjs', 'abp-resource:blank-js' ],
        data: 'text',
    } ],
]);
