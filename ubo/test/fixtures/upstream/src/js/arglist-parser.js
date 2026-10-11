export class ArglistParser {
    constructor(separatorChar = ',', mustQuote = false) {
        this.separatorChar = this.actualSeparatorChar = separatorChar;
        this.separatorCode = this.actualSeparatorCode = separatorChar.charCodeAt(0);
        this.mustQuote = mustQuote;
    }
    nextArg(pattern, from = 0) {
        return { pattern, from, closing: pattern.indexOf(')', from) };
    }
}
