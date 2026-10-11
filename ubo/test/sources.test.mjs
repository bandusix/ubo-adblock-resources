// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Sources, sha256, resolveCommit, SourceError } from '../src/sources.mjs';
import { loadFixture, fakeFetch, FIXTURE_COMMIT, REPO } from './helpers.mjs';

const fx = await loadFixture();
const tmp = () => mkdtemp(join(tmpdir(), 'ubo-src-'));
const noSleep = () => Promise.resolve();

test('a tag is resolved to a commit through one API call; a 40-hex ref needs none', async () => {
  const f = fakeFetch(fx);
  assert.equal(await resolveCommit(REPO, 'v1', { fetchImpl: f, sleep: noSleep }), FIXTURE_COMMIT);
  assert.equal(f.log.length, 1);
  assert.match(f.log[0], /^https:\/\/api\.github\.com\/repos\/gorhill\/uBlock\/commits\/v1$/);
  assert.equal(await resolveCommit(REPO, FIXTURE_COMMIT, { fetchImpl: f }), FIXTURE_COMMIT);
  assert.equal(f.log.length, 1);
  await assert.rejects(() => resolveCommit(REPO, 'nope', { fetchImpl: f, sleep: noSleep }), SourceError);
});

test('files are fetched at the commit, recorded with url / sha256 / size, and cached for the next run and for --offline', async () => {
  const dir = await tmp();
  const f = fakeFetch(fx);
  const s = await Sources.open({ repo: REPO, ref: 'v1', cacheDir: dir, fetchImpl: f, sleep: noSleep });
  const buf = await s.read('src/web_accessible_resources/noop.js');
  assert.ok(buf.equals(fx.get('src/web_accessible_resources/noop.js')));
  await s.read('src/js/resources/base.js');
  await s.saveManifest();
  const rec = s.files().find(x => x.path === 'src/web_accessible_resources/noop.js');
  assert.deepEqual(rec, {
    path: 'src/web_accessible_resources/noop.js',
    url: 'https://raw.githubusercontent.com/gorhill/uBlock/' + FIXTURE_COMMIT + '/src/web_accessible_resources/noop.js',
    sha256: sha256(fx.get('src/web_accessible_resources/noop.js')), size: fx.get('src/web_accessible_resources/noop.js').length,
  });
  assert.deepEqual(s.files().map(x => x.path), ['src/js/resources/base.js', 'src/web_accessible_resources/noop.js']); // sorted

  // second run, same commit: served from the cache, no raw.githubusercontent.com request
  const f2 = fakeFetch(fx);
  const s2 = await Sources.open({ repo: REPO, ref: 'v1', cacheDir: dir, fetchImpl: f2, sleep: noSleep });
  await s2.read('src/js/resources/base.js');
  assert.equal(f2.log.filter(u => u.includes('raw.githubusercontent.com')).length, 0);

  // offline: no fetch implementation is even called
  const never = async () => { throw new Error('network used'); };
  const s3 = await Sources.open({ cacheDir: dir, offline: true, fetchImpl: never });
  assert.equal(s3.commit, FIXTURE_COMMIT);
  assert.equal(s3.ref, 'v1');
  assert.ok((await s3.read('src/js/resources/base.js')).equals(fx.get('src/js/resources/base.js')));
  await assert.rejects(() => s3.read('src/js/resources/utils.js'), /not in the cache/);
  await rm(dir, { recursive: true });
});

test('--offline refuses a cache file whose content no longer matches the recorded sha256', async () => {
  const dir = await tmp();
  const s = await Sources.open({ repo: REPO, ref: FIXTURE_COMMIT, cacheDir: dir, fetchImpl: fakeFetch(fx), sleep: noSleep });
  await s.read('src/js/resources/base.js');
  await s.saveManifest();
  await writeFile(join(dir, 'files', 'src', 'js', 'resources', 'base.js'), 'tampered');
  const off = await Sources.open({ cacheDir: dir, offline: true });
  await assert.rejects(() => off.read('src/js/resources/base.js'), /does not match its recorded sha256/);
  // online, the damaged cache entry is simply downloaded again
  const on = await Sources.open({ repo: REPO, ref: FIXTURE_COMMIT, cacheDir: dir, fetchImpl: fakeFetch(fx), sleep: noSleep });
  assert.ok((await on.read('src/js/resources/base.js')).equals(fx.get('src/js/resources/base.js')));
});

test('a cache for another commit is not reused', async () => {
  const dir = await tmp();
  const s = await Sources.open({ repo: REPO, ref: FIXTURE_COMMIT, cacheDir: dir, fetchImpl: fakeFetch(fx), sleep: noSleep });
  await s.read('src/js/resources/base.js');
  await s.saveManifest();
  const other = 'f'.repeat(40);
  const changed = new Map(fx);
  changed.set('src/js/resources/base.js', Buffer.from('// new upstream'));
  const f = fakeFetch(changed, { commit: other });
  const s2 = await Sources.open({ repo: REPO, ref: other, cacheDir: dir, fetchImpl: f, sleep: noSleep });
  assert.equal((await s2.read('src/js/resources/base.js')).toString(), '// new upstream');
});

test('offline with a --ref that is not what the cache holds is an error', async () => {
  const dir = await tmp();
  const s = await Sources.open({ repo: REPO, ref: 'v1', cacheDir: dir, fetchImpl: fakeFetch(fx), sleep: noSleep });
  await s.read('src/js/resources/base.js');
  await s.saveManifest();
  await assert.rejects(() => Sources.open({ cacheDir: dir, offline: true, ref: 'v2' }), /cache holds v1/);
  const empty = await tmp();
  await assert.rejects(() => Sources.open({ cacheDir: empty, offline: true }), /missing or unreadable/);
});

test('only raw.githubusercontent.com and api.github.com over https; no path tricks; 404 is final, 5xx is retried', async () => {
  const dir = await tmp();
  const s = await Sources.open({ repo: REPO, ref: FIXTURE_COMMIT, cacheDir: dir, fetchImpl: fakeFetch(fx), sleep: noSleep });
  for (const bad of ['../x', '/etc/passwd', 'a//b', 'a/./b', '']) await assert.rejects(() => s.read(bad), /bad source path/);
  await assert.rejects(() => s.read('src/js/resources/missing.js'), /404/);
  await assert.rejects(() => Sources.open({ repo: 'a/b/c', ref: FIXTURE_COMMIT, cacheDir: dir }), /bad repository name/);
  let calls = 0;
  const flaky = async () => { calls++; return calls < 3 ? new Response('', { status: 503 }) : new Response('ok', { status: 200 }); };
  const s2 = await Sources.open({ repo: REPO, ref: FIXTURE_COMMIT, cacheDir: await tmp(), fetchImpl: flaky, sleep: noSleep });
  assert.equal((await s2.read('x.txt')).toString(), 'ok');
  assert.equal(calls, 3);
  const always = async () => new Response('', { status: 500 });
  await assert.rejects(async () => (await Sources.open({ repo: REPO, ref: FIXTURE_COMMIT, cacheDir: await tmp(), fetchImpl: always, sleep: noSleep })).read('y.txt'), /could not fetch/);
});

test('files over the size limit are refused', async () => {
  const big = async () => new Response(Buffer.alloc(5 * 1024 * 1024), { status: 200 });
  const s = await Sources.open({ repo: REPO, ref: FIXTURE_COMMIT, cacheDir: await tmp(), fetchImpl: big, sleep: noSleep });
  await assert.rejects(() => s.read('big.bin'), /larger than/);
});

test('the manifest lists exactly the files the run used', async () => {
  const dir = await tmp();
  const s = await Sources.open({ repo: REPO, ref: 'v1', cacheDir: dir, fetchImpl: fakeFetch(fx), sleep: noSleep });
  await s.read('src/js/resources/base.js');
  await s.saveManifest();
  const m = JSON.parse(await readFile(join(dir, 'upstream.json'), 'utf8'));
  assert.equal(m.commit, FIXTURE_COMMIT);
  assert.equal(m.ref, 'v1');
  assert.deepEqual(m.files.map(f => f.path), ['src/js/resources/base.js']);
});
