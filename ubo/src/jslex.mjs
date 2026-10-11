// SPDX-License-Identifier: GPL-3.0-or-later
// A small JavaScript tokenizer: just enough to find where declarations start and end in uBlock Origin's scriptlet
// modules and to read object / array literals, WITHOUT executing any downloaded code.
// Comments are skipped; strings, template literals and regex literals are single tokens.

export class LexError extends Error {}

const KEYWORDS_BEFORE_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await',
]);
// Longest first.
const PUNCT = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**',
];
const ID_START = /[\p{ID_Start}$_]/u;
const ID_PART = /[\p{ID_Continue}$‌‍]/u;

/**
 * @param {string} src
 * @returns {{t:string,v:string,s:number,e:number}[]}  t: id | num | str | tpl | re | p
 */
export function tokenize(src) {
  return lex(src, 0, false).tokens;
}

function lex(src, start, stopAtCloseBrace) {
  const tokens = [];
  const n = src.length;
  let i = start;
  let braceDepth = 0;
  const prev = () => tokens[tokens.length - 1];
  const regexAllowed = () => {
    const p = prev();
    if (!p) return true;
    if (p.t === 'num' || p.t === 'str' || p.t === 'tpl' || p.t === 're') return false;
    if (p.t === 'id') return KEYWORDS_BEFORE_REGEX.has(p.v);
    // punctuator
    return !(p.v === ')' || p.v === ']' || p.v === '}' || p.v === '++' || p.v === '--');
  };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ' || c === '﻿' || c === ' ' || c === ' ') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n' && src[i] !== '\r') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      if (j < 0) throw new LexError('unterminated comment at ' + i);
      i = j + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n') throw new LexError('newline in string at ' + i);
        j++;
      }
      if (j >= n) throw new LexError('unterminated string at ' + i);
      tokens.push({ t: 'str', v: src.slice(i, j + 1), s: i, e: j + 1 });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      const j = skipTemplate(src, i + 1);
      tokens.push({ t: 'tpl', v: src.slice(i, j), s: i, e: j });
      i = j;
      continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      for (;;) {
        if (j >= n || src[j] === '\n') throw new LexError('unterminated regex at ' + i);
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) break;
        j++;
      }
      j++;
      while (j < n && /[A-Za-z]/.test(src[j])) j++;
      tokens.push({ t: 're', v: src.slice(i, j), s: i, e: j });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_.]/.test(src[j])) {
        // 1e+5 / 1E-5
        if ((src[j] === 'e' || src[j] === 'E') && (src[j + 1] === '+' || src[j + 1] === '-') && !/^0[xX]/.test(src.slice(i, j))) j++;
        j++;
      }
      tokens.push({ t: 'num', v: src.slice(i, j), s: i, e: j });
      i = j;
      continue;
    }
    if (ID_START.test(c) || c === '\\') {
      let j = i + 1;
      while (j < n && (ID_PART.test(src[j]) || src[j] === '\\')) j++;
      tokens.push({ t: 'id', v: src.slice(i, j), s: i, e: j });
      i = j;
      continue;
    }
    if (c === '#' && ID_START.test(src[i + 1] || '')) { // private name
      let j = i + 2;
      while (j < n && ID_PART.test(src[j])) j++;
      tokens.push({ t: 'id', v: src.slice(i, j), s: i, e: j });
      i = j;
      continue;
    }
    // punctuator
    if (c === '{') braceDepth++;
    if (c === '}') {
      if (braceDepth === 0) {
        if (stopAtCloseBrace) return { tokens, end: i };
        throw new LexError('unbalanced "}" at ' + i);
      }
      braceDepth--;
    }
    let p = null;
    for (const cand of PUNCT) { if (src.startsWith(cand, i)) { p = cand; break; } }
    if (p === null) {
      if ('{}()[];,:.?<>=+-*/%&|^!~@'.includes(c)) p = c;
      else throw new LexError('unexpected character ' + JSON.stringify(c) + ' at ' + i);
    }
    tokens.push({ t: 'p', v: p, s: i, e: i + p.length });
    i += p.length;
  }
  if (stopAtCloseBrace) throw new LexError('unterminated template expression');
  return { tokens, end: i };
}

function skipTemplate(src, i) {
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && src[i + 1] === '{') {
      const r = lex(src, i + 2, true);
      i = r.end + 1; // past the closing brace
      continue;
    }
    i++;
  }
  throw new LexError('unterminated template literal');
}

/** Index of the token that closes the bracket opened at tokens[i] ('(' '[' '{'). */
export function matchClose(tokens, i) {
  const open = tokens[i].v;
  const close = open === '(' ? ')' : open === '[' ? ']' : '}';
  let depth = 0;
  for (let j = i; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.t !== 'p') continue;
    if (t.v === open) depth++;
    else if (t.v === close) { depth--; if (depth === 0) return j; }
  }
  throw new LexError('no matching ' + close + ' for the ' + open + ' at ' + tokens[i].s);
}

/** Decode a 'str' token to its value (handles the escapes that occur in resource names and arguments). */
export function strValue(tok) {
  if (tok.t !== 'str') throw new LexError('not a string: ' + tok.v);
  const body = tok.v.slice(1, -1);
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, e) => {
    switch (e[0]) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'v': return '\v';
      case '0': return '\0';
      case 'x': return String.fromCharCode(parseInt(e.slice(1), 16));
      case 'u': return e[1] === '{' ? String.fromCodePoint(parseInt(e.slice(2, -1), 16)) : String.fromCharCode(parseInt(e.slice(1), 16));
      case '\n': return '';
      default: return e;
    }
  });
}

/**
 * Parse a literal made only of strings, numbers, true/false/null, identifiers (as {ref}), arrays and objects.
 * Returns {value, next} where next is the token index after the literal.  Anything else throws: an upstream format change must
 * be noticed, not guessed at.
 */
export function parseLiteral(tokens, i) {
  const t = tokens[i];
  if (!t) throw new LexError('unexpected end of input');
  if (t.t === 'str') return { value: strValue(t), next: i + 1 };
  if (t.t === 'num') return { value: Number(t.v), next: i + 1 };
  if (t.t === 'id') {
    if (t.v === 'true') return { value: true, next: i + 1 };
    if (t.v === 'false') return { value: false, next: i + 1 };
    if (t.v === 'null') return { value: null, next: i + 1 };
    if (tokens[i + 1] && tokens[i + 1].t === 'p' && tokens[i + 1].v === '.') throw new LexError('member expression in a literal at ' + t.s);
    return { value: { ref: t.v }, next: i + 1 };
  }
  if (t.t === 'p' && t.v === '[') {
    const out = [];
    let j = i + 1;
    while (!(tokens[j].t === 'p' && tokens[j].v === ']')) {
      const r = parseLiteral(tokens, j);
      out.push(r.value);
      j = r.next;
      if (tokens[j].t === 'p' && tokens[j].v === ',') j++;
    }
    return { value: out, next: j + 1 };
  }
  if (t.t === 'p' && t.v === '{') {
    const out = {};
    let j = i + 1;
    while (!(tokens[j].t === 'p' && tokens[j].v === '}')) {
      const k = tokens[j];
      let key;
      if (k.t === 'id') key = k.v;
      else if (k.t === 'str') key = strValue(k);
      else throw new LexError('unsupported object key ' + k.v + ' at ' + k.s);
      if (!(tokens[j + 1].t === 'p' && tokens[j + 1].v === ':')) throw new LexError('shorthand / method properties are not supported (' + key + ')');
      const r = parseLiteral(tokens, j + 2);
      out[key] = r.value;
      j = r.next;
      if (tokens[j].t === 'p' && tokens[j].v === ',') j++;
    }
    return { value: out, next: j + 1 };
  }
  throw new LexError('unsupported literal token ' + JSON.stringify(t.v) + ' at ' + t.s);
}
