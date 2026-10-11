// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { convert, serialize, PERMISSION_TRUSTED } from '../src/convert.mjs';
import { ModuleError } from '../src/jsmodule.mjs';
import { RedirectError } from '../src/redirects.mjs';
import { GLOBALS_SHIM_NAME } from '../src/scriptlets.mjs';
import { loadFixture, readerFor, withFile, text, GOLDEN } from './helpers.mjs';

const fx = await loadFixture();
const { resources, info } = await convert(readerFor(fx));
const by = name => resources.find(r => r.name === name);
const body = r => Buffer.from(r.content, 'base64');
const src = r => body(r).toString('utf8');

test('golden output for the fixture (UPDATE_GOLDEN=1 to regenerate after an intentional change, and bump CONVERTER_VERSION)', async () => {
  const got = serialize(resources);
  if (process.env.UPDATE_GOLDEN === '1') {
    await mkdir(dirname(GOLDEN), { recursive: true });
    await writeFile(GOLDEN, got);
  }
  assert.equal(got.toString('utf8'), (await readFile(GOLDEN)).toString('utf8'));
});

test('the same input gives the same bytes, whatever the read order and the object identity', async () => {
  const shuffled = new Map([...fx].reverse());
  const again = await convert(readerFor(shuffled));
  assert.equal(serialize(again.resources).toString('utf8'), serialize(resources).toString('utf8'));
});

test('entry scriptlets are function style templates: text starts with `function name(`', () => {
  const r = by('abort-on-property-read.js');
  assert.equal(r.kind, 'template');
  assert.match(src(r), /^function abortOnPropertyRead\(\n/);
  assert.deepEqual(r.aliases, ['aopr.js']);
  assert.deepEqual(r.dependencies, ['get-exception-token.fn', 'safe-self.fn']);
  assert.equal(r.permission, undefined);
});

test('helpers are fn/javascript and carry their dependencies, resolved from function identifiers', () => {
  const r = by('get-exception-token.fn');
  assert.deepEqual(r.kind, { mime: 'fn/javascript' });
  assert.deepEqual(r.dependencies, ['get-random-token.fn']);
  assert.deepEqual(by('get-random-token.fn').dependencies, ['safe-self.fn']);
});

test('registrations made with builtinScriptlets.push, before the function declaration, are found; string dependencies kept', () => {
  const r = by('remove-class.js');
  assert.match(src(r), /^function removeClass\(/);
  assert.deepEqual(r.aliases, ['rc.js']);
  assert.deepEqual(r.dependencies, ['on-idle.fn', 'safe-self.fn']);
  assert.ok(src(r).includes('/["\'}]/'), 'the regex literal with quotes and a brace survived intact');
  assert.equal(src(r).trimEnd().slice(-1), '}');
  assert.equal(by('noop-scriptlet.js').dependencies, undefined);
});

test('template literals with nested ${} and a closing brace do not truncate a function', () => {
  const r = by('on-idle.fn');
  assert.ok(src(r).includes('`idle:${ `${options && options.timeout}` }}`'));
  assert.ok(src(r).trimEnd().endsWith('}'));
});

test('a class behind an import alias (export const A = __A__) becomes a helper whose text is the class', () => {
  const r = by('arglist-parser.fn');
  assert.deepEqual(r.kind, { mime: 'fn/javascript' });
  assert.match(src(r), /^class ArglistParser \{/);
  assert.ok(src(r).includes('nextArg(pattern, from = 0)'));
  assert.ok(src(r).trimEnd().endsWith('}'));
});

test('the free variable scriptletGlobals gets a shim dependency (and only where it is used)', () => {
  assert.deepEqual(by('safe-self.fn').dependencies, [GLOBALS_SHIM_NAME]);
  assert.ok(src(by(GLOBALS_SHIM_NAME)).startsWith('var scriptletGlobals'));
  assert.equal(by('get-random-token.fn').dependencies.includes(GLOBALS_SHIM_NAME), false);
});

test('requiresTrust becomes permission 1 on scriptlets and on redirect resources; nothing else gets a permission', () => {
  assert.equal(by('trusted-set-cookie.js').permission, PERMISSION_TRUSTED);
  assert.equal(by('google-ima-dai.js').permission, PERMISSION_TRUSTED);
  assert.deepEqual(resources.filter(r => r.permission).map(r => r.name).sort(), ['google-ima-dai.js', 'trusted-set-cookie.js']);
  assert.deepEqual(info.trusted, ['google-ima-dai.js', 'trusted-set-cookie.js']);
  assert.deepEqual(by('trusted-set-cookie.js').dependencies, ['arglist-parser.fn', 'safe-self.fn']);
});

test('MIME types come from the file name and use the spelling adblock-rust knows', () => {
  assert.deepEqual(by('noop.js').kind, { mime: 'application/javascript' });
  assert.deepEqual(by('noop.html').kind, { mime: 'text/html' });
  assert.deepEqual(by('1x1.gif').kind, { mime: 'image/gif' });
  assert.deepEqual(by('noop-0.1s.mp3').kind, { mime: 'audio/mp3' });
  assert.deepEqual(by('crlf.txt').kind, { mime: 'text/plain' });
  assert.deepEqual(by('empty').kind, { mime: 'text/plain' });
});

test('aliases of redirect resources are all kept, sorted, including the abp-resource: ones and the slash ones', () => {
  assert.deepEqual(by('noop.js').aliases, ['abp-resource:blank-js', 'noopjs']);
  assert.deepEqual(by('gpl-header.js').aliases, ['abp-resource:gpl-header', 'gpl.example.com/header.js']);
  assert.deepEqual(by('1x1.gif').aliases, ['1x1-transparent.gif']);
  assert.deepEqual(by('crlf.txt').aliases, ['nooptext']);
});

test('binary resources are byte-exact, text resources are LF-normalised, uBO\'s own GPL header is stripped, other attributions stay', async () => {
  assert.ok(body(by('1x1.gif')).equals(fx.get('src/web_accessible_resources/1x1.gif')));
  assert.ok(body(by('noop-0.1s.mp3')).equals(fx.get('src/web_accessible_resources/noop-0.1s.mp3')));
  assert.equal(src(by('crlf.txt')), 'line one\nline two\n');
  assert.equal(src(by('empty')), '');
  assert.equal(src(by('gpl-header.js')), '(function() {\n    window.gplFixture = 1;\n})();\n');
  assert.ok(src(by('mozilla-based.js')).startsWith('/**\n *\n * Source below is based on Mozilla source code'));
  assert.ok(src(by('google-ima-dai.js')).startsWith('// Repo: https://github.com/AdguardTeam/Scriptlets'));
  assert.equal(src(by('noop.js')), fx.get('src/web_accessible_resources/noop.js').toString());
});

test('resources whose map entry has `params` are skipped and reported', () => {
  assert.equal(by('click2load.html'), undefined);
  assert.deepEqual(info.skipped.map(s => s.name), ['click2load.html']);
});

test('counts and the dependency-closure check', () => {
  assert.equal(info.scriptlets, 4); // aopr, trusted-set-cookie, remove-class, noop-scriptlet
  assert.equal(info.helpers, 6);    // safe-self, get-random-token, get-exception-token, on-idle, arglist-parser, shim
  assert.equal(info.redirects, 9);
  assert.deepEqual(info.warnings, []);
  assert.deepEqual(info.isolatedWorld, ['remove-class.js', 'trusted-set-cookie.js']);
});

test('every dependency name resolves to a resource and no name or alias is used twice', () => {
  const names = new Set();
  for (const r of resources) for (const id of [r.name, ...r.aliases]) { assert.equal(names.has(id), false, id); names.add(id); }
  for (const r of resources) for (const d of r.dependencies || []) assert.ok(resources.some(x => x.name === d), r.name + ' -> ' + d);
});

// ---- things that must fail loudly

const failing = async (map, errType, re) => assert.rejects(() => convert(readerFor(map)), e => e instanceof errType && re.test(e.message));

test('a scriptlet name registered twice is an error', async () => {
  const m = withFile(fx, 'src/js/resources/scriptlets.js', text(fx, 'src/js/resources/scriptlets.js') + "\nbuiltinScriptlets.push({ name: 'rc.js', fn: noopScriptlet });\nbuiltinScriptlets.push({ name: 'noop-scriptlet.js', fn: noopScriptlet });\n");
  await failing(m, ModuleError, /registered twice|two names/);
});

test('a dependency that is not registered is an error (string and function-identifier forms)', async () => {
  const s = text(fx, 'src/js/resources/scriptlets.js').replace("'on-idle.fn'", "'no-such.fn'");
  await failing(withFile(fx, 'src/js/resources/scriptlets.js', s), ModuleError, /no-such\.fn.*not registered/);
  const t = text(fx, 'src/js/resources/trusted.js').replace('ArglistParser,\n        safeSelf,', 'ArglistParser,\n        notDeclared,\n        safeSelf,');
  await failing(withFile(fx, 'src/js/resources/trusted.js', t), ModuleError, /notDeclared/);
});

test('an entry scriptlet that is not `function name(` is an error (the engine could not call it)', async () => {
  const s = text(fx, 'src/js/resources/scriptlets.js') + "\nclass Bad { run() {} }\nbuiltinScriptlets.push({ name: 'bad.js', fn: Bad });\n";
  await failing(withFile(fx, 'src/js/resources/scriptlets.js', s), ModuleError, /bad\.js.*named function declaration/);
  const t = text(fx, 'src/js/resources/scriptlets.js') + "\nasync function later() {}\nbuiltinScriptlets.push({ name: 'later.js', fn: later });\n";
  await failing(withFile(fx, 'src/js/resources/scriptlets.js', t), ModuleError, /later\.js.*named function declaration/);
});

test('an unrecognised top-level statement that touches the registry is an error, an unrelated one is tolerated', async () => {
  const s = text(fx, 'src/js/resources/scriptlets.js') + "\n[ 'a', 'b' ].forEach(n => builtinScriptlets.push({ name: n, fn: noopScriptlet }));\n";
  await failing(withFile(fx, 'src/js/resources/scriptlets.js', s), ModuleError, /unrecognised top-level statement/);
  const ok = withFile(fx, 'src/js/resources/scriptlets.js', text(fx, 'src/js/resources/scriptlets.js') + "\nconsole.log('hello');\n");
  assert.equal((await convert(readerFor(ok))).resources.length, resources.length);
});

test('`export *` and namespace imports are refused', async () => {
  await failing(withFile(fx, 'src/js/resources/aopr.js', "export * from './utils.js';\n" + text(fx, 'src/js/resources/aopr.js')), ModuleError, /export \*/);
  await failing(withFile(fx, 'src/js/resources/aopr.js', "import * as u from './utils.js';\n" + text(fx, 'src/js/resources/aopr.js')), ModuleError, /namespace imports/);
});

test('a name or alias shared by a scriptlet and a redirect resource is an error, never a silent override', async () => {
  const s = text(fx, 'src/js/redirect-resources.js').replace("alias: '1x1-transparent.gif'", "alias: 'aopr.js'");
  await assert.rejects(() => convert(readerFor(withFile(fx, 'src/js/redirect-resources.js', s))), /clash.*aopr\.js/);
});

test('unknown properties in the redirect map, duplicate entries and a changed map format are errors', async () => {
  const s = text(fx, 'src/js/redirect-resources.js');
  await failing(withFile(fx, 'src/js/redirect-resources.js', s.replace("data: 'blob',", "data: 'blob', surprise: 1,")), RedirectError, /unknown property `surprise`/);
  await failing(withFile(fx, 'src/js/redirect-resources.js', s.replace("[ 'noop.html', {", "[ 'noop.js', {")), RedirectError, /noop\.js appears twice/);
  await failing(withFile(fx, 'src/js/redirect-resources.js', 'export default {};'), RedirectError, /cannot find `new Map/);
});

test('a missing upstream file stops the conversion', async () => {
  const m = new Map(fx);
  m.delete('src/web_accessible_resources/noop.js');
  await assert.rejects(() => convert(readerFor(m)), /no file src\/web_accessible_resources\/noop\.js/);
});

test('a function that does not parse after conversion stops the run (compile check; nothing is executed)', async () => {
  const bad = text(fx, 'src/js/resources/scriptlets.js') + "\nbuiltinScriptlets.push({ name: 'broken.js', fn: broken });\nfunction broken() { return ); }\n";
  await assert.rejects(() => convert(readerFor(withFile(fx, 'src/js/resources/scriptlets.js', bad))), /broken\.js is not valid JavaScript/);
  const jsRedirect = withFile(fx, 'src/web_accessible_resources/noop.js', '(function() {\n');
  await assert.rejects(() => convert(readerFor(jsRedirect)), /noop\.js is not valid JavaScript/);
  let ran = false;
  globalThis.__ubo_marker = () => { ran = true; };
  const evil = withFile(fx, 'src/web_accessible_resources/noop.js', '__ubo_marker();');
  await convert(readerFor(evil));
  assert.equal(ran, false, 'converted code must never be executed');
  delete globalThis.__ubo_marker;
});
