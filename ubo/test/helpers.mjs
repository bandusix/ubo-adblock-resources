// SPDX-License-Identifier: GPL-3.0-or-later
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = join(HERE, 'fixtures', 'upstream');
export const GOLDEN = join(HERE, 'fixtures', 'expected', 'ubo-resources.json');
export const FIXTURE_COMMIT = '0123456789abcdef0123456789abcdef01234567';
export const REPO = 'gorhill/uBlock';

async function walk(dir, out) {
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

/** The fixture "upstream checkout" as Map<repo-relative path, Buffer>. */
export async function loadFixture() {
  const files = await walk(FIXTURE_DIR, []);
  const m = new Map();
  for (const f of files) m.set(relative(FIXTURE_DIR, f).split('\\').join('/'), await readFile(f));
  return m;
}

export const readerFor = map => async p => {
  if (!map.has(p)) throw new Error('fixture has no file ' + p);
  return map.get(p);
};

export const text = (map, p) => map.get(p).toString('utf8');

export function withFile(map, path, content) {
  const m = new Map(map);
  m.set(path, Buffer.from(content));
  return m;
}

/**
 * A fake `fetch` serving a fixture map as raw.githubusercontent.com and a ref table as api.github.com.
 * `log` receives every requested URL.
 */
export function fakeFetch(map, { commit = FIXTURE_COMMIT, refs = { 'v1': commit, [commit]: commit }, log = [] } = {}) {
  const impl = async (url, init = {}) => {
    log.push(String(url));
    const u = new URL(url);
    if (u.hostname === 'api.github.com') {
      const m = /^\/repos\/([^/]+\/[^/]+)\/commits\/(.+)$/.exec(u.pathname);
      const ref = m && decodeURIComponent(m[2]);
      if (m && refs[ref]) return new Response(refs[ref], { status: 200 });
      return new Response('{"message":"Not Found"}', { status: 404 });
    }
    if (u.hostname === 'raw.githubusercontent.com') {
      const m = /^\/([^/]+\/[^/]+)\/([0-9a-f]{40})\/(.+)$/.exec(u.pathname);
      if (m && m[2] === commit && map.has(m[3])) return new Response(map.get(m[3]), { status: 200 });
      return new Response('404: Not Found', { status: 404 });
    }
    throw new Error('unexpected host in test: ' + u.hostname);
  };
  impl.log = log;
  return impl;
}
