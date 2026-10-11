// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, matchClose, parseLiteral, strValue, LexError } from '../src/jslex.mjs';

const vals = src => tokenize(src).map(t => t.t + ':' + t.v);

test('comments are skipped, strings and templates are single tokens', () => {
  assert.deepEqual(vals("a /* x } */ + 'b}\\'' // tail\n + `c${ `}${1}` }d`"), ['id:a', 'p:+', "str:'b}\\''", 'p:+', 'tpl:`c${ `}${1}` }d`']);
});

test('regex literal vs division', () => {
  assert.deepEqual(vals('x = a / b / c'), ['id:x', 'p:=', 'id:a', 'p:/', 'id:b', 'p:/', 'id:c']);
  assert.deepEqual(vals('x = /[/}"\']+/g.test(s)').slice(0, 3), ['id:x', 'p:=', "re:/[/}\"']+/g"]);
  assert.deepEqual(vals('return /a\\/b/i'), ['id:return', 're:/a\\/b/i']);
  assert.deepEqual(vals('(a) / 2 / 3').slice(3), ['p:/', 'num:2', 'p:/', 'num:3']);
  assert.deepEqual(vals('x ? /a/ : /b/').filter(v => v.startsWith('re:')), ['re:/a/', 're:/b/']);
});

test('a brace inside a regex, string or template does not unbalance matchClose', () => {
  const toks = tokenize("function f() { const r = /}/; const s = '}'; const t = `${'}'}}`; return 1; } tail");
  const open = toks.findIndex(t => t.v === '{');
  assert.equal(toks[matchClose(toks, open) + 1].v, 'tail');
});

test('unterminated constructs are errors, not silent truncation', () => {
  assert.throws(() => tokenize("'abc"), LexError);
  assert.throws(() => tokenize('`abc'), LexError);
  assert.throws(() => tokenize('/* abc'), LexError);
  assert.throws(() => tokenize('a }'), LexError);
});

test('numbers, private names and multi-character operators', () => {
  assert.deepEqual(vals('a?.b ?? 1e+5 >>>= 0x1F'), ['id:a', 'p:?.', 'id:b', 'p:??', 'num:1e+5', 'p:>>>=', 'num:0x1F']);
});

test('strValue decodes the escapes that occur in names and arguments', () => {
  const t = tokenize("'a\\x41\\u0042\\u{43}\\n\\'z'")[0];
  assert.equal(strValue(t), "aABC\n'z");
});

test('parseLiteral: objects, arrays, identifiers as refs, booleans', () => {
  const toks = tokenize("{ name: 'x.js', 'aliases': [ 'a', \"b\", ], dependencies: [ foo, 'bar.fn' ], requiresTrust: true, n: 3, z: null }");
  const { value, next } = parseLiteral(toks, 0);
  assert.equal(next, toks.length);
  assert.deepEqual(value, { name: 'x.js', aliases: ['a', 'b'], dependencies: [{ ref: 'foo' }, 'bar.fn'], requiresTrust: true, n: 3, z: null });
});

test('parseLiteral refuses what it cannot interpret instead of guessing', () => {
  assert.throws(() => parseLiteral(tokenize('{ a() {} }'), 0), LexError);
  assert.throws(() => parseLiteral(tokenize('{ a: foo.bar }'), 0), LexError);
  assert.throws(() => parseLiteral(tokenize('{ a: `t` }'), 0), LexError);
  assert.throws(() => parseLiteral(tokenize('{ ...x }'), 0), LexError);
});
