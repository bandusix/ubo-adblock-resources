// SPDX-License-Identifier: GPL-3.0-or-later
// Static reading of one ES module of uBlock Origin's scriptlet library: imports, exports, top-level function / class / const
// declarations (with their exact source text, which is what Function.prototype.toString() would return) and the scriptlet
// registrations (`registerScriptlet(fn, {...})` and `builtinScriptlets.push({...})`).  Nothing is executed.

import { tokenize, matchClose, strValue, parseLiteral, LexError } from './jslex.mjs';

export class ModuleError extends Error {}

const REGISTRY_NAMES = new Set(['registerScriptlet', 'builtinScriptlets', 'registeredScriptlets']);

const isP = (t, v) => t && t.t === 'p' && t.v === v;
const isId = (t, v) => t && t.t === 'id' && (v === undefined || t.v === v);

/** @returns the parsed module */
export function parseModule(path, src) {
  let tokens;
  try { tokens = tokenize(src); } catch (e) { throw new ModuleError(path + ': ' + e.message); }
  const mod = {
    path, src, tokens,
    imports: [],          // { from, specs: [{imported, local}] }   (side-effect imports have specs = [])
    importByLocal: new Map(), // local -> { from, imported }
    decls: new Map(),     // local name -> { kind: 'function'|'class'|'const', text, alias, exported }
    exportsMap: new Map(),// exported name -> local name (for `export { a as b }`)
    reexports: [],        // { from, imported, exported }
    registrations: [],    // { via, fnRef, details, at }
    skipped: [],          // top-level statements we did not understand and that do not mention the registry
  };
  let i = 0;
  const n = tokens.length;
  while (i < n) {
    const start = i;
    if (isP(tokens[i], ';')) { i++; continue; }
    let h = i;
    let exported = false;
    if (isId(tokens[h], 'export')) { exported = true; h++; }
    const isDefault = exported && isId(tokens[h], 'default');
    if (isDefault) h++;

    if (isId(tokens[i], 'import') && !isP(tokens[i + 1], '(') && !isP(tokens[i + 1], '.')) {
      i = readImport(mod, i);
      continue;
    }
    if (exported && isP(tokens[h], '{')) {
      i = readExportList(mod, h);
      continue;
    }
    if (exported && isP(tokens[h], '*')) throw new ModuleError(path + ': `export *` is not supported');
    const declStart = h; // `async function` keeps its `async`: Function.prototype.toString() would too
    if (isId(tokens[h], 'async') && isId(tokens[h + 1], 'function')) h++;
    if (isId(tokens[h], 'function') || isId(tokens[h], 'class')) {
      const isClass = tokens[h].v === 'class';
      let j = h + 1;
      if (isP(tokens[j], '*')) j++;
      const nameTok = tokens[j];
      if (!nameTok || nameTok.t !== 'id' || nameTok.v === 'extends') {
        if (isDefault) throw new ModuleError(path + ': anonymous default export is not supported');
        throw new ModuleError(path + ': declaration without a name at ' + tokens[h].s);
      }
      // find the body brace, skipping ( ) groups (parameters may contain object literals) and `extends` expressions
      j++;
      while (j < n && !isP(tokens[j], '{')) {
        if (isP(tokens[j], '(') || isP(tokens[j], '[')) j = matchClose(tokens, j);
        j++;
      }
      if (j >= n) throw new ModuleError(path + ': no body for ' + nameTok.v);
      const close = matchClose(tokens, j);
      const text = src.slice(tokens[declStart].s, tokens[close].e);
      mod.decls.set(nameTok.v, { kind: isClass ? 'class' : 'function', text, alias: null, exported, name: nameTok.v });
      if (isDefault) mod.exportsMap.set('default', nameTok.v);
      i = close + 1;
      continue;
    }
    // everything else: a statement ending at ';' (depth 0)
    let j = h;
    while (j < n && !isP(tokens[j], ';')) {
      if (isP(tokens[j], '(') || isP(tokens[j], '[') || isP(tokens[j], '{')) j = matchClose(tokens, j);
      j++;
    }
    const stmt = tokens.slice(start, Math.min(j, n));
    i = j + 1;
    const first = tokens[h];
    if (first && first.t === 'id' && (first.v === 'const' || first.v === 'let' || first.v === 'var')) {
      readVarDecl(mod, tokens, h, Math.min(j, n), exported, src);
      continue;
    }
    if (readRegistration(mod, stmt)) continue;
    if (stmt.some(t => t.t === 'id' && REGISTRY_NAMES.has(t.v))) {
      throw new ModuleError(path + ': unrecognised top-level statement that mentions the scriptlet registry (at offset ' + stmt[0].s + '): ' + src.slice(stmt[0].s, Math.min(stmt[stmt.length - 1].e, stmt[0].s + 120)));
    }
    mod.skipped.push(src.slice(stmt[0].s, Math.min(stmt[stmt.length - 1].e, stmt[0].s + 60)).replace(/\s+/g, ' '));
  }
  return mod;
}

function readImport(mod, i) {
  const { tokens } = mod;
  let j = i + 1;
  const specs = [];
  if (tokens[j].t === 'str') { // import './x.js';
    mod.imports.push({ from: strValue(tokens[j]), specs });
    return j + 2;
  }
  if (isId(tokens[j]) && !isP(tokens[j]) && tokens[j].v !== 'from') { // default import
    specs.push({ imported: 'default', local: tokens[j].v });
    j++;
    if (isP(tokens[j], ',')) j++;
  }
  if (isP(tokens[j], '*')) throw new ModuleError(mod.path + ': namespace imports are not supported');
  if (isP(tokens[j], '{')) {
    const close = matchClose(tokens, j);
    let k = j + 1;
    while (k < close) {
      const a = tokens[k];
      if (!isId(a)) throw new ModuleError(mod.path + ': bad import specifier at ' + a.s);
      let local = a.v;
      if (isId(tokens[k + 1], 'as')) { local = tokens[k + 2].v; k += 2; }
      specs.push({ imported: a.v, local });
      k++;
      if (isP(tokens[k], ',')) k++;
    }
    j = close + 1;
  }
  if (!isId(tokens[j], 'from') || tokens[j + 1].t !== 'str') throw new ModuleError(mod.path + ': malformed import at ' + tokens[i].s);
  const from = strValue(tokens[j + 1]);
  mod.imports.push({ from, specs });
  for (const s of specs) mod.importByLocal.set(s.local, { from, imported: s.imported });
  return j + 3 < tokens.length && isP(tokens[j + 2], ';') ? j + 3 : j + 2;
}

function readExportList(mod, i) {
  const { tokens } = mod;
  const close = matchClose(tokens, i);
  const pairs = [];
  let k = i + 1;
  while (k < close) {
    const a = tokens[k];
    let exportedName = a.v;
    if (isId(tokens[k + 1], 'as')) { exportedName = tokens[k + 2].v; k += 2; }
    pairs.push({ local: a.v, exported: exportedName });
    k++;
    if (isP(tokens[k], ',')) k++;
  }
  let j = close + 1;
  if (isId(tokens[j], 'from')) {
    const from = strValue(tokens[j + 1]);
    for (const p of pairs) mod.reexports.push({ from, imported: p.local, exported: p.exported });
    j += 2;
  } else {
    for (const p of pairs) mod.exportsMap.set(p.exported, p.local);
  }
  if (isP(tokens[j], ';')) j++;
  return j;
}

function readVarDecl(mod, tokens, h, end, exported, src) {
  // const a = <expr>, b = <expr>;   Only the first declarator's shape is classified; multi-declarator statements are rare in uBO.
  const nameTok = tokens[h + 1];
  if (!nameTok || nameTok.t !== 'id') { mod.skipped.push('destructuring declaration'); return; }
  const eq = tokens[h + 2];
  if (!isP(eq, '=')) { mod.skipped.push('declaration of ' + nameTok.v + ' without initialiser'); return; }
  const initStart = h + 3;
  const init = tokens.slice(initStart, end);
  let alias = null;
  if (init.length === 1 && init[0].t === 'id' && !['true', 'false', 'null', 'undefined'].includes(init[0].v)) alias = init[0].v;
  const text = init.length ? src.slice(init[0].s, init[init.length - 1].e) : '';
  mod.decls.set(nameTok.v, { kind: 'const', text, alias, exported, name: nameTok.v });
}

function readRegistration(mod, stmt) {
  // registerScriptlet ( ident , { ... } )
  if (isId(stmt[0], 'registerScriptlet') && isP(stmt[1], '(')) {
    const close = matchClose(stmt, 1);
    if (!isId(stmt[2]) || !isP(stmt[3], ',')) return false;
    if (close !== stmt.length - 1) return false;
    const r = parseLiteralSafe(mod, stmt, 4);
    if (r.next !== close) return false;
    mod.registrations.push({ via: 'registerScriptlet', fnRef: stmt[2].v, details: r.value, at: stmt[0].s });
    return true;
  }
  // builtinScriptlets . push ( { ... } )
  if (isId(stmt[0]) && REGISTRY_NAMES.has(stmt[0].v) && isP(stmt[1], '.') && isId(stmt[2], 'push') && isP(stmt[3], '(')) {
    const close = matchClose(stmt, 3);
    if (close !== stmt.length - 1) return false;
    const r = parseLiteralSafe(mod, stmt, 4);
    if (r.next !== close) return false;
    const d = r.value;
    if (!d || typeof d !== 'object' || !d.fn || typeof d.fn !== 'object' || typeof d.fn.ref !== 'string') {
      throw new ModuleError(mod.path + ': builtinScriptlets.push without an `fn: identifier` at ' + stmt[0].s);
    }
    const { fn, ...details } = d;
    mod.registrations.push({ via: 'push', fnRef: fn.ref, details, at: stmt[0].s });
    return true;
  }
  return false;
}

function parseLiteralSafe(mod, stmt, i) {
  try { return parseLiteral(stmt, i); } catch (e) {
    if (e instanceof LexError) throw new ModuleError(mod.path + ': cannot read the registration at offset ' + stmt[0].s + ': ' + e.message);
    throw e;
  }
}
