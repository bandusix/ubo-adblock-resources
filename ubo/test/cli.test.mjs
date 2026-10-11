// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, readdir, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/cli.mjs';
import { META_FILE, OUTPUT_FILE, CONVERTER_VERSION } from '../src/version.mjs';
import { loadFixture, fakeFetch, withFile, text, FIXTURE_COMMIT, GOLDEN } from './helpers.mjs';

const fx = await loadFixture();
const tmp = () => mkdtemp(join(tmpdir(), 'ubo-cli-'));
const noSleep = () => Promise.resolve();

async function cli(args, map = fx, opts = {}) {
  const lines = [];
  const code = await run(args, { log: m => lines.push(m), fetchImpl: fakeFetch(map, opts), sleep: noSleep });
  return { code, out: lines.join('\n'), lines };
}
const readJson = async p => JSON.parse(await readFile(p, 'utf8'));

test('first run: writes the resources and the meta, with provenance and licence', async () => {
  const out = await tmp();
  const r = await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c')]);
  assert.equal(r.code, 0);
  assert.equal((await readFile(join(out, OUTPUT_FILE))).toString(), (await readFile(GOLDEN)).toString());
  const meta = await readJson(join(out, META_FILE));
  assert.equal(meta.upstream.repo, 'https://github.com/gorhill/uBlock');
  assert.equal(meta.upstream.ref, 'v1');
  assert.equal(meta.upstream.commit, FIXTURE_COMMIT);
  assert.equal(meta.upstream.license_url, 'https://github.com/gorhill/uBlock/blob/' + FIXTURE_COMMIT + '/LICENSE.txt');
  assert.equal(meta.license, 'GPL-3.0-or-later');
  assert.match(meta.notice, /downloaded .* NOT distributed with the application binary/);
  assert.equal(meta.converter.version, CONVERTER_VERSION);
  assert.equal(meta.output.count, 19);
  assert.equal(meta.output.scriptlets, 4);
  assert.equal(meta.output.helpers, 6);
  assert.equal(meta.output.redirects, 9);
  assert.deepEqual(Object.keys(meta.resources).length, 19);
  for (const f of meta.files) {
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
    assert.ok(f.url.startsWith('https://raw.githubusercontent.com/gorhill/uBlock/' + FIXTURE_COMMIT + '/'));
    assert.ok(f.size >= 0);
  }
  const notice = Object.fromEntries(meta.files.map(f => [f.path, f.license_notice]));
  assert.equal(notice['src/js/resources/base.js'], 'GPL-3.0-or-later');
  assert.equal(notice['src/web_accessible_resources/noop.js'], 'none found');
  assert.equal(notice['src/web_accessible_resources/1x1.gif'], 'binary (no place for a notice)');
  assert.match(notice['src/web_accessible_resources/mozilla-based.js'], /Mozilla/);
  assert.match(notice['src/web_accessible_resources/google-ima-dai.js'], /AdGuard/);
  assert.equal(notice['LICENSE.txt'], 'licence text');
  assert.ok(meta.files.some(f => f.path === 'LICENSE.txt'));
  assert.ok(r.out.includes('first conversion'));
});

test('output is byte-for-byte reproducible: a second directory, an offline run from the first run\'s cache', async () => {
  const a = await tmp(), b = await tmp(), c = await tmp();
  await cli(['--ref', 'v1', '--out', a, '--cache', join(a, 'c'), '--readable', join(a, 'r')]);
  await cli(['--ref', 'v1', '--out', b, '--cache', join(b, 'c'), '--readable', join(b, 'r')]);
  const off = await run(['--offline', join(a, 'c'), '--out', c, '--readable', join(c, 'r')], { log: () => {}, fetchImpl: async () => { throw new Error('network used'); } });
  assert.equal(off, 0);
  for (const f of [OUTPUT_FILE, META_FILE, 'r/INDEX.tsv', 'r/scriptlets/abort-on-property-read.js']) {
    const ref = await readFile(join(a, f));
    assert.ok(ref.equals(await readFile(join(b, f))), f + ' differs between two online runs');
    assert.ok(ref.equals(await readFile(join(c, f))), f + ' differs in the offline run');
  }
});

test('--state: unchanged upstream files and converter -> reports "unchanged" and rewrites nothing', async () => {
  const out = await tmp();
  await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c')]);
  const past = new Date(Date.now() - 3600_000);
  for (const f of [OUTPUT_FILE, META_FILE]) await utimes(join(out, f), past, past);
  const before = { r: (await stat(join(out, OUTPUT_FILE))).mtimeMs, m: (await stat(join(out, META_FILE))).mtimeMs };
  const r = await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--state', join(out, META_FILE)]);
  assert.equal(r.code, 0);
  assert.match(r.out, /^unchanged:/m);
  assert.equal((await stat(join(out, OUTPUT_FILE))).mtimeMs, before.r);
  assert.equal((await stat(join(out, META_FILE))).mtimeMs, before.m);
  assert.ok(!r.out.includes('wrote '));
});

test('--state: upstream moved to a new commit but the files are identical -> still "unchanged", with a note', async () => {
  const out = await tmp();
  await cli(['--ref', 'main', '--out', out, '--cache', join(out, 'c')], fx, { refs: { main: FIXTURE_COMMIT, [FIXTURE_COMMIT]: FIXTURE_COMMIT } });
  const other = 'e'.repeat(40);
  const r = await cli(['--ref', 'main', '--out', out, '--cache', join(out, 'c'), '--state', join(out, META_FILE)], fx, { commit: other, refs: { main: other, [other]: other } });
  assert.match(r.out, /^unchanged:.*moved from 0123456789ab to eeeeeeeeeeee without touching them/m);
});

test('--state: a changed upstream file re-converts and prints which resources were added / removed / changed', async () => {
  const out = await tmp();
  await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c')]);
  const prevResources = await readFile(join(out, OUTPUT_FILE));
  let m = withFile(fx, 'src/js/resources/aopr.js', text(fx, 'src/js/resources/aopr.js').replace('if ( chain === \'\' ) { return; }', "if ( chain === '' ) { return; } // changed upstream"));
  m = withFile(m, 'src/web_accessible_resources/noop.html', '<!DOCTYPE html><html></html>\n');
  m = withFile(m, 'src/js/redirect-resources.js', text(m, 'src/js/redirect-resources.js').replace("    [ 'noop.html', {", "    [ 'noop-new.txt', {\n        data: 'text',\n    } ],\n    [ 'noop.html', {").replace("    [ 'empty', {\n        data: 'text',   // Important!\n    } ],\n", ''));
  m = withFile(m, 'src/web_accessible_resources/noop-new.txt', 'new');
  const other = 'd'.repeat(40);
  const r = await cli(['--ref', 'v2', '--out', out, '--cache', join(out, 'c'), '--state', join(out, META_FILE)], m, { commit: other, refs: { v2: other, [other]: other } });
  assert.equal(r.code, 0);
  assert.ok(!/^unchanged/m.test(r.out));
  assert.match(r.out, /upstream: v1 \(0123456789ab\) -> v2 \(dddddddddddd\)/);
  assert.match(r.out, /added \(1\): noop-new\.txt/);
  assert.match(r.out, /removed \(1\): empty/);
  assert.match(r.out, /changed \(2\): abort-on-property-read\.js, noop\.html/);
  assert.match(r.out, /source files changed \(\d+\): .*src\/js\/resources\/aopr\.js/);
  assert.notEqual((await readFile(join(out, OUTPUT_FILE))).toString(), prevResources.toString());
  const meta = await readJson(join(out, META_FILE));
  assert.equal(meta.upstream.commit, other);
  assert.equal(meta.output.count, 19);
});

test('--state: a different converter version forces a re-conversion even when upstream is the same', async () => {
  const out = await tmp();
  await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c')]);
  const meta = await readJson(join(out, META_FILE));
  meta.converter.version = '0.0.0-older';
  await writeFile(join(out, 'old-state.json'), JSON.stringify(meta));
  const r = await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--state', join(out, 'old-state.json')]);
  assert.ok(!/^unchanged/m.test(r.out));
  assert.match(r.out, /converter: 0\.0\.0-older -> /);
  assert.match(r.out, /wrote /);
});

test('--state: a missing state file is a first run; a state whose output file was removed or edited is re-converted', async () => {
  const out = await tmp();
  const r1 = await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--state', join(out, META_FILE)]);
  assert.match(r1.out, /does not exist yet/);
  await writeFile(join(out, OUTPUT_FILE), '[]\n');
  const r2 = await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--state', join(out, META_FILE)]);
  assert.match(r2.out, /missing or differs from the recorded sha256: converting again/);
  assert.equal((await readFile(join(out, OUTPUT_FILE))).toString(), (await readFile(GOLDEN)).toString());
});

test('a corrupt state file is an error, not a silent first run', async () => {
  const out = await tmp();
  await writeFile(join(out, 'bad.json'), '{not json');
  await assert.rejects(() => cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--state', join(out, 'bad.json')]), /cannot read --state/);
});

test('argument errors', async () => {
  await assert.rejects(() => cli(['--ref', 'v1']), /--out is required/);
  await assert.rejects(() => cli(['--out', '/tmp/x']), /--ref is required/);
  await assert.rejects(() => cli(['--ref', 'v1', '--out', '/tmp/x', '--bogus']), /Unknown option/);
});

test('the upstream LICENSE.txt is checked: if it stops being GPL-3 the run fails', async () => {
  const out = await tmp();
  const m = withFile(fx, 'LICENSE.txt', 'Some other licence\n');
  await assert.rejects(() => cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c')], m), /not the GPL-3\.0 text/);
});

test('--readable writes the review tree next to the JSON; with an unchanged state it only restores a missing tree', async () => {
  const out = await tmp();
  const rd = join(out, 'readable');
  await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--readable', rd]);
  assert.ok((await readdir(rd)).includes('INDEX.tsv'));
  await writeFile(join(rd, 'scriptlets', 'stale-extra.js'), 'x');
  await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--readable', rd]); // re-run without state: tree is rebuilt, stale file gone
  await assert.rejects(() => stat(join(rd, 'scriptlets', 'stale-extra.js')));
  await import('node:fs/promises').then(f => f.rm(rd, { recursive: true }));
  const r = await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c'), '--state', join(out, META_FILE), '--readable', rd]);
  assert.match(r.out, /^unchanged:/m);
  assert.match(r.out, /readable view was missing/);
  assert.ok((await readdir(rd)).includes('INDEX.tsv'));
});

test('--state: the same list of upstream files with ONE file\'s content changed is not "unchanged"', async () => {
  const out = await tmp();
  await cli(['--ref', 'v1', '--out', out, '--cache', join(out, 'c')]);
  const other = 'c'.repeat(40);
  const m = withFile(fx, 'src/web_accessible_resources/noop.js', '(function() { /* edited upstream */ })();\n');
  const r = await cli(['--ref', 'v2', '--out', out, '--cache', join(out, 'c'), '--state', join(out, META_FILE)], m, { commit: other, refs: { v2: other, [other]: other } });
  assert.ok(!/^unchanged/m.test(r.out));
  assert.match(r.out, /changed \(1\): noop\.js/);
  assert.match(r.out, /source files changed \(1\): src\/web_accessible_resources\/noop\.js/);
  assert.ok(!/added|removed/.test(r.out.split('changed:')[1].split('\n').filter(l => /^\s+(added|removed) \(/.test(l)).join('')));
});
