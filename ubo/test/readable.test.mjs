// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { convert } from '../src/convert.mjs';
import { renderReadable, writeReadable, HEADER_PREFIX } from '../src/readable.mjs';
import { loadFixture, readerFor } from './helpers.mjs';

const fx = await loadFixture();
const { resources } = await convert(readerFor(fx));
const files = renderReadable(resources);
const str = p => files.get(p).toString('utf8');
const content = name => Buffer.from(resources.find(r => r.name === name).content, 'base64');
const sha = b => createHash('sha256').update(b).digest('hex');

test('text resources get their own file: scriptlets/, helpers/, redirects/', () => {
  assert.deepEqual([...files.keys()].sort(), [
    'INDEX.tsv',
    'helpers/arglist-parser.fn.js', 'helpers/get-exception-token.fn.js', 'helpers/get-random-token.fn.js', 'helpers/on-idle.fn.js',
    'helpers/safe-self.fn.js', 'helpers/scriptlet-globals.fn.js',
    'redirects/crlf.txt', 'redirects/crlf.txt.aliases', 'redirects/empty', 'redirects/google-ima-dai.js', 'redirects/gpl-header.js',
    'redirects/mozilla-based.js', 'redirects/noop.html', 'redirects/noop.html.aliases', 'redirects/noop.js',
    'scriptlets/abort-on-property-read.js', 'scriptlets/noop-scriptlet.js', 'scriptlets/remove-class.js', 'scriptlets/trusted-set-cookie.js',
  ]);
});

test('binary resources are not written as files, only listed (name, sha256, size) in INDEX.tsv', () => {
  assert.ok(![...files.keys()].some(k => /1x1\.gif|noop-0\.1s/.test(k)));
  const rows = str('INDEX.tsv').trimEnd().split('\n').map(l => l.split('\t'));
  const gif = rows.find(r => r[1] === '1x1.gif');
  assert.deepEqual(gif, ['(binary, not written)', '1x1.gif', 'image/gif', '1x1-transparent.gif', '', '0', sha(content('1x1.gif')), String(content('1x1.gif').length)]);
});

test('JS files carry a header with name / kind / aliases / dependencies / permission; stripping it gives exactly the decoded content', () => {
  for (const n of ['abort-on-property-read.js', 'trusted-set-cookie.js', 'noop-scriptlet.js']) {
    const s = str('scriptlets/' + n);
    const head = s.slice(0, s.indexOf('\n\n') + 2);
    assert.ok(head.split('\n').filter(Boolean).every(l => l.startsWith(HEADER_PREFIX)));
    assert.equal(s.slice(head.length), content(n).toString('utf8'));
  }
  assert.equal(str('scriptlets/abort-on-property-read.js').split('\n').slice(0, 4).join('|'),
    '// ubo-resources: name=abort-on-property-read.js|// ubo-resources: kind=template|// ubo-resources: aliases=aopr.js|// ubo-resources: dependencies=get-exception-token.fn safe-self.fn');
  assert.match(str('scriptlets/trusted-set-cookie.js'), /\/\/ ubo-resources: permission=1\n/);
  assert.match(str('redirects/noop.js'), /^\/\/ ubo-resources: name=noop\.js\n\/\/ ubo-resources: kind=application\/javascript\n\/\/ ubo-resources: aliases=abp-resource:blank-js noopjs\n\n\(function/);
});

test('non-JS text is exact content, its aliases go to a sibling .aliases file', () => {
  assert.equal(str('redirects/noop.html'), content('noop.html').toString());
  assert.equal(str('redirects/noop.html.aliases'), 'noopframe\n');
  assert.equal(str('redirects/crlf.txt'), 'line one\nline two\n');
  assert.equal(str('redirects/empty'), '');
});

test('all files use LF only and the index is sorted by name', () => {
  for (const [k, v] of files) assert.ok(!v.includes('\r'), k + ' contains CR');
  const names = str('INDEX.tsv').trimEnd().split('\n').slice(1).map(l => l.split('\t')[1]);
  assert.deepEqual(names, [...names].sort());
});

test('writeReadable removes stale files in its own directories only, and is repeatable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ubo-rd-'));
  const n1 = await writeReadable(resources, dir);
  const first = await readFile(join(dir, 'INDEX.tsv'));
  await (await import('node:fs/promises')).writeFile(join(dir, 'scriptlets', 'stale.js'), 'x');
  await (await import('node:fs/promises')).writeFile(join(dir, 'README-keep.md'), 'mine');
  const n2 = await writeReadable(resources, dir);
  assert.equal(n1, n2);
  assert.ok((await readFile(join(dir, 'INDEX.tsv'))).equals(first));
  assert.deepEqual((await readdir(join(dir, 'scriptlets'))).sort(), ['abort-on-property-read.js', 'noop-scriptlet.js', 'remove-class.js', 'trusted-set-cookie.js']);
  assert.equal(await readFile(join(dir, 'README-keep.md'), 'utf8'), 'mine');
});
