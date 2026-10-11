// SPDX-License-Identifier: GPL-3.0-or-later
// Mutation check for the test suite:  node test/mutants.mjs   (npm run mutate)
// Copies the converter to a temp directory, breaks one thing at a time (a lost alias, a missing dependency, a wrong MIME ...) and
// runs the suite against the broken copy.  Every mutant must make the suite fail ("killed"); a survivor means a gap in the tests.

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** [id, file, exact text to find (must occur exactly once), replacement] */
export const MUTANTS = [
  ['scriptlet aliases lost', 'src/scriptlets.mjs', "aliases: strList(d.aliases, d.name + '.aliases'),", 'aliases: [],'],
  ['redirect aliases lost', 'src/redirects.mjs', 'aliases: e.aliases.slice(), kind: { mime }', 'aliases: [], kind: { mime }'],
  ['function-identifier dependencies dropped', 'src/scriptlets.mjs', '        deps.push(nm);', '        void nm;'],
  ['string dependencies dropped', 'src/scriptlets.mjs', "if (typeof dep === 'string') deps.push(dep);", "if (typeof dep === 'string') void dep;"],
  ['scriptletGlobals shim not added', 'src/scriptlets.mjs', "if (mentions(r.text, 'scriptletGlobals')) {", 'if (false) {'],
  ['shim text wrong', 'src/scriptlets.mjs', "'var scriptletGlobals = (typeof", "'var scriptletGlobalz = (typeof"],
  ['JS redirects get the wrong MIME', 'src/redirects.mjs', "['js', 'application/javascript']", "['js', 'text/javascript']"],
  ['mp3 MIME wrong', 'src/redirects.mjs', "['mp3', 'audio/mp3']", "['mp3', 'audio/mpeg']"],
  ['permission dropped from scriptlets', 'src/convert.mjs', "    if (r.requiresTrust) o.permission = PERMISSION_TRUSTED;\n    out.push(o);\n  }\n  for (const r of rd)", "    out.push(o);\n  }\n  for (const r of rd)"],
  ['permission dropped from redirect resources', 'src/convert.mjs', "    if (r.requiresTrust) o.permission = PERMISSION_TRUSTED;\n    out.push(o);\n  }\n  out.sort", "    out.push(o);\n  }\n  out.sort"],
  ['function text loses its closing brace', 'src/jsmodule.mjs', 'tokens[declStart].s, tokens[close].e)', 'tokens[declStart].s, tokens[close].s)'],
  ['the compile check is skipped', 'src/convert.mjs', 'try { new vm.Script(code, { filename: label }); }', 'try { void code; }'],
  ['entry scriptlets get a redirectable kind', 'src/scriptlets.mjs', "kind: r.helper ? { mime: 'fn/javascript' } : 'template',", "kind: r.helper ? { mime: 'fn/javascript' } : { mime: 'application/javascript' },"],
  ['helpers lose the fn/javascript kind', 'src/scriptlets.mjs', "kind: r.helper ? { mime: 'fn/javascript' } : 'template',", "kind: r.helper ? 'template' : 'template',"],
  ['regex literals are read as division', 'src/jslex.mjs', "return !(p.v === ')' || p.v === ']' || p.v === '}' || p.v === '++' || p.v === '--');", 'return false;'],
  ['content is base64 of the wrong bytes', 'src/convert.mjs', "content: b64(Buffer.from(r.text.replace(/\\r\\n?/g, '\\n'), 'utf8')) }", "content: b64(Buffer.from(r.text.replace(/\\r\\n?/g, '\\n').slice(0, -1), 'utf8')) }"],
  ['every top comment is stripped, attributions included', 'src/redirects.mjs', "return /GNU General Public License/.test(m[0]) && /Copyright \\(C\\)/.test(m[0]) ? text.slice(m[0].length) : text;", 'return text.slice(m[0].length);'],
  ['CRLF not normalised in redirect text', 'src/redirects.mjs', "  return s.replace(/\\r\\n?/g, '\\n');", '  return s;'],
  ['output not sorted', 'src/convert.mjs', "  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));", '  /* unsorted */'],
  ['dependencies not sorted', 'src/scriptlets.mjs', 'dependencies: deps.sort(),', 'dependencies: deps.reverse(),'],
  ['params resources are not skipped', 'src/redirects.mjs', 'if (e.params !== undefined) {', 'if (false) {'],
  ['incremental check ignores the converter version', 'src/meta.mjs', 'prev.converter.version !== CONVERTER_VERSION ||', 'false ||'],
  ['incremental check never says unchanged', 'src/meta.mjs', 'return files.every((f, i) =>', 'return false && files.every((f, i) =>'],
  ['incremental check ignores file hashes', 'src/meta.mjs', 'prev.files[i].path === f.path && prev.files[i].sha256 === f.sha256', 'prev.files[i].path === f.path'],
  ['offline cache is not verified against its sha256', 'src/sources.mjs', 'if (buf && sha256(buf) !== known.sha256) {', 'if (false) {'],
  ['cache of another commit is reused', 'src/sources.mjs', 'if (manifest && manifest.repo === repo && manifest.commit === commit)', 'if (manifest)'],
  ['readable: JS header omitted', 'src/readable.mjs', "(js ? headerFor(r) : '')", "''"],
  ['readable: aliases sidecar omitted', 'src/readable.mjs', "if (!js && r.aliases && r.aliases.length) files.set", "if (false) files.set"],
  ['readable: binary resources written as text', 'src/readable.mjs', 'export const isTextResource = r => isTemplate(r) || TEXT_MIMES.has(r.kind.mime);', 'export const isTextResource = r => true;'],
  ['unknown registry statements are ignored', 'src/jsmodule.mjs', 'if (stmt.some(t => t.t === \'id\' && REGISTRY_NAMES.has(t.v))) {', 'if (false) {'],
  ['name clashes are not detected', 'src/convert.mjs', "if (clashes.length) throw", 'if (false) throw'],
  ['upstream licence is not checked', 'src/cli.mjs', "if (!/GNU GENERAL PUBLIC LICENSE[\\s\\S]{0,40}Version 3/i.test(licenseText.toString('utf8'))) throw", "if (false) throw"],
];

function applyMutant(dir, [, file, find, replace]) {
  const p = join(dir, file);
  const s = readFileSync(p, 'utf8');
  const n = s.split(find).length - 1;
  if (n !== 1) return 'anchor occurs ' + n + ' times in ' + file;
  writeFileSync(p, s.replace(find, () => replace));
  return null;
}

function suite(dir) {
  const r = spawnSync(process.execPath, ['--test', ...['jslex', 'jsmodule', 'convert', 'sources', 'cli', 'readable'].map(n => join(dir, 'test', n + '.test.mjs'))], { encoding: 'utf8', cwd: dir, timeout: 120000 });
  return r.status === 0;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
  const base = mkdtempSync(join(tmpdir(), 'ubo-mutants-'));
  let survivors = 0, killed = 0, broken = 0;
  try {
    const clean = join(base, 'clean');
    cpSync(ROOT, clean, { recursive: true, filter: s => !/verify-rs\/target|node_modules|\.upstream-cache|\/out(\/|$)/.test(s) });
    if (!suite(clean)) { console.error('the unmutated suite does not pass; fix that first'); process.exit(2); }
    for (const m of MUTANTS) {
      if (only && !only.test(m[0])) continue;
      const dir = join(base, 'm');
      rmSync(dir, { recursive: true, force: true });
      cpSync(clean, dir, { recursive: true });
      const err = applyMutant(dir, m);
      if (err) { console.log('BROKEN    ' + m[0] + ' (' + err + ')'); broken++; continue; }
      if (suite(dir)) { console.log('SURVIVED  ' + m[0]); survivors++; } else { console.log('killed    ' + m[0]); killed++; }
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
  console.log('\n' + killed + ' killed, ' + survivors + ' survived, ' + broken + ' could not be applied');
  process.exit(survivors || broken ? 1 : 0);
}
