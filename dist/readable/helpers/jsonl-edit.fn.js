// ubo-resources: name=jsonl-edit.fn
// ubo-resources: kind=fn/javascript
// ubo-resources: dependencies=jsonpath.fn safe-self.fn

function jsonlEditFn(jsonp, text = '', jsonExtract) {
    const safe = safeSelf();
    const lineSeparator = /\r?\n/.exec(text)?.[0] || '\n';
    const linesBefore = text.split('\n');
    const linesAfter = [];
    for ( const lineBefore of linesBefore ) {
        const match = jsonExtract.exec(lineBefore);
        if ( match === null ) {
            linesAfter.push(lineBefore);
            continue;
        }
        const jsonBefore = match[1];
        let obj;
        try { obj = safe.JSON_parse(jsonBefore); } catch { }
        if ( typeof obj !== 'object' || obj === null ) {
            linesAfter.push(lineBefore);
            continue;
        }
        const objAfter = jsonp.apply(obj);
        if ( objAfter === undefined ) {
            linesAfter.push(lineBefore);
            continue;
        }
        const jsonAfter = safe.JSON_stringify(objAfter);
        const lineAfter = [
            lineBefore.slice(0, match.index),
            jsonAfter,
            lineBefore.slice(match.index + jsonBefore.length),
        ].join('');
        linesAfter.push(lineAfter);
    }
    return linesAfter.join(lineSeparator);
}