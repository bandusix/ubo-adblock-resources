// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModule, ModuleError } from '../src/jsmodule.mjs';
import { loadGraph, resolveBinding, resolveSpecifier } from '../src/scriptlets.mjs';

test('imports, exports and declarations', () => {
  const m = parseModule('a/x.js', `
    import './side.js';
    import { a, b as c } from './m.js';
    import d from "../d.js";
    export { a as z };
    export { q } from './q.js';
    export function f(x = { y: 1 }) { return \`\${x}}\`; }
    export class K extends (class {}) { m() { return /}/; } }
    async function g() {}
    const alias = f;
    export const arrow = (v) => v;
  `);
  assert.deepEqual(m.imports.map(i => [i.from, i.specs.map(s => s.imported + ':' + s.local).join()]), [['./side.js', ''], ['./m.js', 'a:a,b:c'], ['../d.js', 'default:d']]);
  assert.equal(m.importByLocal.get('c').imported, 'b');
  assert.deepEqual([...m.exportsMap], [['z', 'a']]);
  assert.deepEqual(m.reexports, [{ from: './q.js', imported: 'q', exported: 'q' }]);
  assert.equal(m.decls.get('f').text, 'function f(x = { y: 1 }) { return `${x}}`; }');
  assert.equal(m.decls.get('K').kind, 'class');
  assert.ok(m.decls.get('K').text.endsWith('/}/; } }'));
  assert.equal(m.decls.get('g').text, 'async function g() {}');
  assert.equal(m.decls.get('alias').alias, 'f');
  assert.equal(m.decls.get('arrow').alias, null);
});

test('registrations: registerScriptlet(fn, {...}) and X.push({... fn ...})', () => {
  const m = parseModule('a/y.js', `
    registerScriptlet(f, { name: 'f.js', aliases: [ 'ff.js' ], dependencies: [ g, 'h.fn' ], requiresTrust: true, world: 'ISOLATED' });
    builtinScriptlets.push({ name: 'k.js', fn: k, dependencies: [ 'h.fn' ] });
    registerScriptlet(h , {
        name: 'h.fn',
    });
  `);
  assert.deepEqual(m.registrations.map(r => [r.via, r.fnRef, r.details.name]), [['registerScriptlet', 'f', 'f.js'], ['push', 'k', 'k.js'], ['registerScriptlet', 'h', 'h.fn']]);
  assert.deepEqual(m.registrations[0].details.dependencies, [{ ref: 'g' }, 'h.fn']);
  assert.equal(m.registrations[0].details.requiresTrust, true);
});

test('a registration written in a form we cannot read is an error, never skipped', () => {
  assert.throws(() => parseModule('a/z.js', "registerScriptlet(f, { name: `t.js` });"), ModuleError);
  assert.throws(() => parseModule('a/z.js', "registerScriptlet(f, makeDetails());"), ModuleError);
  assert.throws(() => parseModule('a/z.js', "builtinScriptlets.push({ name: 'a.js' });"), /fn: identifier/);
  assert.throws(() => parseModule('a/z.js', "for (const x of list) registerScriptlet(x, {});"), /mentions the scriptlet registry/);
});

test('module graph: evaluation order follows imports; binding resolution follows aliases, imports and re-exports', async () => {
  const files = {
    'r/a.js': "import { y } from './b.js'; export function x() {} export const alias = x; export { y as yy };",
    'r/b.js': "import { x as ex } from './a.js'; export { ex as e2 } ; export function y() {}",
    'r/c.js': "import { yy } from './a.js'; import { e2 } from './b.js'; export const w = yy; export { e2 as e3 };",
    'r/root.js': "import './c.js'; import { w, e3 } from './c.js';",
  };
  const g = await loadGraph(async p => { if (!(p in files)) throw new Error('no ' + p); return files[p]; }, 'r/root.js');
  // a and b import each other: the module reached second (b) finishes first, as in ES module evaluation
  assert.deepEqual(g.order, ['r/b.js', 'r/a.js', 'r/c.js', 'r/root.js']);
  assert.equal(resolveBinding(g, 'r/root.js', 'w').key, 'r/b.js#y');
  assert.equal(resolveBinding(g, 'r/root.js', 'e3').key, 'r/a.js#x');
  assert.throws(() => resolveBinding(g, 'r/root.js', 'nope'), /not declared or imported/);
  assert.throws(() => resolveBinding(g, 'r/a.js', 'x2'), ModuleError);
});

test('import specifiers must be relative', () => {
  assert.equal(resolveSpecifier('src/js/resources/a.js', '../arglist-parser.js'), 'src/js/arglist-parser.js');
  assert.throws(() => resolveSpecifier('a/b.js', 'lodash'), /non-relative/);
});
