// SPDX-License-Identifier: GPL-3.0-or-later
// uBlock Origin's scriptlet library (ES modules: `registerScriptlet(fn, details)` / `builtinScriptlets.push(details)`) -> adblock-rust
// `Resource` objects.
//
// How adblock-rust 0.13 consumes them (resources/resource_storage.rs): a scriptlet resource whose text starts with
// `function NAME(` is "function style": the engine emits the text of every (transitive) dependency, then the scriptlet's own text,
// then `NAME("arg1", "arg2", ...)` inside `try { } catch ( e ) { }`.  That is exactly the shape of uBO's own assembly
// (`fn.toString()` + dependency names + a call), so no template placeholders are needed and no eval is involved.

import { posix } from 'node:path';
import { tokenize } from './jslex.mjs';
import { parseModule, ModuleError } from './jsmodule.mjs';

/** The engine's own check (resource_storage.rs::extract_function_name). */
export const FUNCTION_STYLE_RE = /^function\s+([^(){}\s]+)\s*\(/;
export const GLOBALS_SHIM_NAME = 'scriptlet-globals.fn';
// `scriptletGlobals` is "externally added to the private namespace in which scriptlets execute" (uBO's own words in safe-self.js);
// outside uBO nothing defines it, and safeSelf() dereferences it.  An empty object means: no logger, no web-accessible-resource origin.
export const GLOBALS_SHIM_TEXT = 'var scriptletGlobals = (typeof scriptletGlobals === "object" && scriptletGlobals) || {};';

export function resolveSpecifier(fromPath, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) throw new ModuleError(fromPath + ': non-relative import ' + spec);
  return posix.normalize(posix.join(posix.dirname(fromPath), spec));
}

/** Read the module graph reachable from `root` through `read(path) -> Promise<string>`.  Returns modules in ES evaluation order. */
export async function loadGraph(read, root) {
  const modules = new Map();
  const order = [];
  const visiting = new Set();
  async function visit(path) {
    if (modules.has(path) || visiting.has(path)) return;
    visiting.add(path);
    const mod = parseModule(path, await read(path));
    modules.set(path, mod);
    for (const imp of mod.imports) await visit(resolveSpecifier(path, imp.from));
    for (const re of mod.reexports) await visit(resolveSpecifier(path, re.from));
    order.push(path);
  }
  await visit(root);
  return { modules, order };
}

/** Follow aliases / imports / re-exports until a function or class declaration is found. -> {key, decl, module} */
export function resolveBinding(graph, modPath, local, trail = []) {
  const mod = graph.modules.get(modPath);
  if (!mod) throw new ModuleError('module ' + modPath + ' is not loaded');
  const id = modPath + '#' + local;
  if (trail.includes(id)) throw new ModuleError('alias cycle at ' + id);
  trail = [...trail, id];
  const d = mod.decls.get(local);
  if (d) {
    if (d.kind === 'function' || d.kind === 'class') return { key: modPath + '#' + d.name, decl: d, module: modPath };
    if (d.alias) return resolveBinding(graph, modPath, d.alias, trail);
    throw new ModuleError(modPath + ': `' + local + '` is a constant that is not a plain alias of a function or class, it cannot be used as a scriptlet function');
  }
  const imp = mod.importByLocal.get(local);
  if (imp) return resolveExport(graph, resolveSpecifier(modPath, imp.from), imp.imported, trail);
  throw new ModuleError(modPath + ': identifier `' + local + '` is not declared or imported at module level');
}

function resolveExport(graph, modPath, name, trail) {
  const mod = graph.modules.get(modPath);
  if (!mod) throw new ModuleError('module ' + modPath + ' is not loaded');
  if (mod.exportsMap.has(name)) return resolveBinding(graph, modPath, mod.exportsMap.get(name), trail);
  const re = mod.reexports.find(r => r.exported === name);
  if (re) return resolveExport(graph, resolveSpecifier(modPath, re.from), re.imported, trail);
  const d = mod.decls.get(name);
  if (d && d.exported) return resolveBinding(graph, modPath, name, trail);
  throw new ModuleError(modPath + ' does not export `' + name + '`');
}

const KNOWN_DETAIL_KEYS = new Set(['name', 'aliases', 'dependencies', 'requiresTrust', 'world', 'priority']);

const strList = (v, what) => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new ModuleError(what + ' must be an array of strings');
  return v;
};

/**
 * Registrations (in module evaluation order) -> intermediate scriptlet records:
 *  { name, aliases, deps: [name], requiresTrust, world, fnName, text, helper }
 * Throws on anything ambiguous.
 */
export function collectScriptlets(graph) {
  const regs = [];
  for (const path of graph.order) {
    for (const r of graph.modules.get(path).registrations) regs.push({ ...r, module: path });
  }
  // definition -> registered name (what `fn.details.name` is in uBO)
  const nameOfDef = new Map();
  const staged = [];
  for (const r of regs) {
    const def = resolveBinding(graph, r.module, r.fnRef);
    const d = r.details;
    if (typeof d.name !== 'string' || d.name === '') throw new ModuleError(r.module + ': registration of `' + r.fnRef + '` has no name');
    if (nameOfDef.has(def.key) && nameOfDef.get(def.key) !== d.name) {
      throw new ModuleError('function ' + def.key + ' is registered under two names (' + nameOfDef.get(def.key) + ', ' + d.name + ')');
    }
    nameOfDef.set(def.key, d.name);
    staged.push({ r, def });
  }
  const seen = new Map();
  const out = [];
  for (const { r, def } of staged) {
    const d = r.details;
    const deps = [];
    for (const dep of (d.dependencies === undefined ? [] : d.dependencies)) {
      if (typeof dep === 'string') deps.push(dep);
      else if (dep && typeof dep === 'object' && typeof dep.ref === 'string') {
        const t = resolveBinding(graph, r.module, dep.ref);
        const nm = nameOfDef.get(t.key);
        if (nm === undefined) throw new ModuleError(r.module + ': dependency `' + dep.ref + '` of ' + d.name + ' is not a registered scriptlet function');
        deps.push(nm);
      } else throw new ModuleError(r.module + ': bad dependency entry in ' + d.name);
    }
    if (seen.has(d.name)) throw new ModuleError('scriptlet name ' + d.name + ' is registered twice (' + seen.get(d.name) + ' and ' + r.module + ')');
    seen.set(d.name, r.module);
    out.push({
      name: d.name,
      aliases: strList(d.aliases, d.name + '.aliases'),
      deps,
      requiresTrust: d.requiresTrust === true,
      world: typeof d.world === 'string' ? d.world : 'MAIN',
      fnName: def.decl.name,
      kind: def.decl.kind,
      text: def.decl.text,
      module: r.module,
      helper: d.name.endsWith('.fn'),
      extraKeys: Object.keys(d).filter(k => !KNOWN_DETAIL_KEYS.has(k)),
    });
  }
  return out;
}

/** True when the (comment-free) token stream of `text` mentions the free identifier `id`. */
function mentions(text, id) {
  return tokenize(text).some(t => t.t === 'id' && t.v === id);
}

/**
 * Intermediate records -> Resource objects (without base64: `text` is kept, the caller encodes).  Adds the globals shim,
 * validates the function-style contract and checks that dependency names resolve.
 */
export function scriptletResources(recs) {
  const byName = new Map(recs.map(r => [r.name, r]));
  const warnings = [];
  const out = [];
  const declared = new Map(); // declared function/class name -> record name (they end up in ONE global scope in the injected script)
  let needShim = false;
  for (const r of recs) {
    if (declared.has(r.fnName) && declared.get(r.fnName) !== r.name) {
      throw new ModuleError('two different scriptlet resources declare the same global name `' + r.fnName + '`: ' + declared.get(r.fnName) + ' and ' + r.name);
    }
    declared.set(r.fnName, r.name);
    if (r.extraKeys.length) warnings.push(r.name + ' has registration properties this converter does not interpret: ' + r.extraKeys.join(', '));
    const deps = r.deps.slice();
    if (mentions(r.text, 'scriptletGlobals')) {
      if (!deps.includes(GLOBALS_SHIM_NAME)) deps.push(GLOBALS_SHIM_NAME);
      needShim = true;
    }
    for (const d of deps) {
      if (d !== GLOBALS_SHIM_NAME && !byName.has(d)) throw new ModuleError(r.name + ' depends on ' + d + ', which is not registered');
      if (d === r.name) throw new ModuleError(r.name + ' depends on itself');
    }
    if (r.helper) {
      // helpers are plain text dependencies (function or class declarations)
    } else {
      const m = FUNCTION_STYLE_RE.exec(r.text);
      if (!m) throw new ModuleError(r.name + ': a scriptlet must be a named function declaration (`function name(`); got ' + JSON.stringify(r.text.slice(0, 40)));
      if (m[1] !== r.fnName) throw new ModuleError(r.name + ': declared function name ' + r.fnName + ' differs from the one the engine will call (' + m[1] + ')');
    }
    out.push({
      name: r.name,
      aliases: r.aliases,
      kind: r.helper ? { mime: 'fn/javascript' } : 'template',
      text: r.text,
      dependencies: deps.sort(),
      requiresTrust: r.requiresTrust,
      world: r.world,
      origin: r.module,
    });
  }
  if (needShim) {
    out.push({
      name: GLOBALS_SHIM_NAME, aliases: [], kind: { mime: 'fn/javascript' }, text: GLOBALS_SHIM_TEXT, dependencies: [],
      requiresTrust: false, world: 'MAIN', origin: '(added by the converter)',
    });
  }
  // dependency-closure check: a function that calls another registered function without listing it would throw at run time
  const declNames = new Map(); // declared name -> resource name
  for (const r of recs) declNames.set(r.fnName, r.name);
  const closure = name => {
    const seenN = new Set();
    const walk = n => {
      if (seenN.has(n)) return;
      seenN.add(n);
      const rr = out.find(x => x.name === n);
      if (rr) rr.dependencies.forEach(walk);
    };
    walk(name);
    return seenN;
  };
  const resByName = new Map(out.map(r => [r.name, r]));
  for (const r of recs) {
    const toks = tokenize(r.text);
    const have = closure(r.name);
    const used = new Set();
    // names the function declares itself (inner functions, variables) shadow the registered ones
    const local = new Set();
    for (let i = 1; i < toks.length; i++) {
      if (toks[i].t === 'id' && toks[i - 1].t === 'id' && ['function', 'const', 'let', 'var', 'class'].includes(toks[i - 1].v)) local.add(toks[i].v);
    }
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t !== 'id' || !declNames.has(t.v) || t.v === r.fnName || local.has(t.v)) continue;
      const prevT = toks[i - 1];
      if (prevT && prevT.t === 'p' && prevT.v === '.') continue; // property access, not a binding reference
      if (prevT && prevT.t === 'id' && prevT.v === 'typeof') continue; // optional presence test, e.g. proxy-apply-config.js
      used.add(declNames.get(t.v));
    }
    for (const u of used) if (!have.has(u) && resByName.has(u)) warnings.push(r.name + ' mentions the function of ' + u + ' but does not (transitively) depend on it');
  }
  return { resources: out, warnings };
}
