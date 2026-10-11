// SPDX-License-Identifier: GPL-3.0-or-later
// Licence hygiene: every source file of the converter carries the SPDX line (the output is GPL-3.0-or-later data; the code that makes it is
// declared the same until the maintainers decide otherwise, see LICENSE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function files(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['fixtures', 'node_modules', 'target', 'out', '.upstream-cache'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await files(p, out);
    else if (/\.(mjs|rs)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('every .mjs / .rs file starts with an SPDX-License-Identifier line', async () => {
  const all = [...await files(join(ROOT, 'src')), ...await files(join(ROOT, 'test')), ...await files(join(ROOT, 'verify-rs'))];
  assert.ok(all.length >= 15);
  for (const f of all) {
    const head = (await readFile(f, 'utf8')).split('\n').slice(0, 3).join('\n');
    assert.match(head, /SPDX-License-Identifier: GPL-3\.0-or-later/, f);
  }
});

test('package.json, Cargo.toml and LICENSE agree on the licence', async () => {
  assert.equal(JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).license, 'GPL-3.0-or-later');
  assert.match(await readFile(join(ROOT, 'verify-rs', 'Cargo.toml'), 'utf8'), /license = "GPL-3\.0-or-later"/);
  assert.match(await readFile(join(ROOT, 'LICENSE'), 'utf8'), /SPDX-License-Identifier: GPL-3\.0-or-later/);
});

test('the converter has no dependencies and needs only node >= 20', async () => {
  const p = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(p.dependencies, undefined);
  assert.equal(p.devDependencies, undefined);
  assert.equal(p.type, 'module');
  assert.equal(p.engines.node, '>=20');
  assert.ok(p.scripts.test && p.scripts.build);
});

test('nothing in src/ imports anything but node: built-ins and its own files', async () => {
  for (const f of await files(join(ROOT, 'src'))) {
    const s = await readFile(f, 'utf8');
    for (const m of s.matchAll(/^import\b[^;'"]*?\bfrom\s+'([^']+)'|^import\s+'([^']+)'|\bimport\(\s*'([^']+)'\s*\)/gm)) {
      const spec = m[1] || m[2] || m[3];
      assert.ok(spec.startsWith('node:') || spec.startsWith('./'), f + ' imports ' + spec);
    }
  }
});
