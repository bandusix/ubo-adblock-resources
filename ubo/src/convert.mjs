// SPDX-License-Identifier: GPL-3.0-or-later
// The whole conversion: upstream files (through `read`) -> adblock-rust Resource objects, deterministic.

import vm from 'node:vm';
import { loadGraph, collectScriptlets, scriptletResources } from './scriptlets.mjs';
import { parseRedirectMap, redirectResources, REDIRECT_MAP_PATH } from './redirects.mjs';

export const SCRIPTLETS_ROOT = 'src/js/resources/scriptlets.js';
export const LICENSE_PATH = 'LICENSE.txt';
/** Brave's convention (list_catalog.json `permission_mask: 1` on every trusted list): bit 0 = "trusted source". */
export const PERMISSION_TRUSTED = 1;

export class ConvertError extends Error {}

const utf8 = buf => new TextDecoder('utf-8', { fatal: true }).decode(buf);
const b64 = buf => Buffer.from(buf).toString('base64');

/**
 * @param read  async (path) => Buffer   (every call is recorded by the caller)
 * @returns {{resources: object[], info: object}}
 *   resources: adblock-rust Resource objects ({name, aliases, kind, content, dependencies?, permission?}), sorted by name
 *   info:      counts, notes and warnings for the meta file
 */
export async function convert(read) {
  // --- scriptlets (function style; see scriptlets.mjs)
  const graph = await loadGraph(async p => utf8(await read(p)), SCRIPTLETS_ROOT);
  const recs = collectScriptlets(graph);
  const { resources: sl, warnings } = scriptletResources(recs);

  // --- redirect resources
  const entries = parseRedirectMap(utf8(await read(REDIRECT_MAP_PATH)));
  const { resources: rd, skipped } = await redirectResources(entries, read);

  // --- one namespace: adblock-rust keeps a single table of names and aliases, a clash would silently drop the second resource
  const owner = new Map();
  const clashes = [];
  const claim = (ident, who) => {
    if (owner.has(ident)) clashes.push(ident + ' (' + owner.get(ident) + ' / ' + who + ')');
    else owner.set(ident, who);
  };
  for (const r of [...sl, ...rd]) {
    claim(r.name, r.name);
    for (const a of r.aliases) claim(a, r.name);
  }
  if (clashes.length) throw new ConvertError('name/alias clashes between scriptlets and redirect resources: ' + clashes.join(', '));

  // Syntax check (compile only, nothing is run): a function cut at the wrong place, or a misread regex, would otherwise only show up in a browser.
  const compiles = (label, code) => {
    try { new vm.Script(code, { filename: label }); } catch (e) { throw new ConvertError(label + ' is not valid JavaScript after conversion: ' + e.message); }
  };
  for (const r of sl) compiles(r.name, r.text);
  for (const r of rd) if (r.kind.mime === 'application/javascript') compiles(r.name, r.bytes.toString('utf8'));

  const out = [];
  for (const r of sl) {
    const o = { name: r.name, aliases: r.aliases.slice().sort(), kind: r.kind, content: b64(Buffer.from(r.text.replace(/\r\n?/g, '\n'), 'utf8')) };
    if (r.dependencies.length) o.dependencies = r.dependencies;
    if (r.requiresTrust) o.permission = PERMISSION_TRUSTED;
    out.push(o);
  }
  for (const r of rd) {
    const o = { name: r.name, aliases: r.aliases.slice().sort(), kind: r.kind, content: b64(r.bytes) };
    if (r.requiresTrust) o.permission = PERMISSION_TRUSTED;
    out.push(o);
  }
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const info = {
    scriptlets: sl.filter(r => r.kind === 'template').length,
    helpers: sl.filter(r => r.kind !== 'template').length,
    redirects: rd.length,
    trusted: out.filter(r => r.permission).map(r => r.name),
    skipped,
    warnings,
    modules: graph.order.slice(),
    isolatedWorld: sl.filter(r => r.world === 'ISOLATED').map(r => r.name).sort(),
    scriptletOrigins: Object.fromEntries(sl.map(r => [r.name, r.origin])),
  };
  return { resources: out, info };
}

/** Deterministic bytes: one resource per line, fixed key order, no timestamps. */
export function serialize(resources) {
  const lines = resources.map(r => {
    const o = { name: r.name, aliases: r.aliases, kind: r.kind, content: r.content };
    if (r.dependencies && r.dependencies.length) o.dependencies = r.dependencies;
    if (r.permission) o.permission = r.permission;
    return JSON.stringify(o);
  });
  return Buffer.from('[\n' + lines.join(',\n') + '\n]\n', 'utf8');
}
