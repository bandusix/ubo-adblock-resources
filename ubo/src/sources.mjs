// SPDX-License-Identifier: GPL-3.0-or-later
// Getting the upstream source files: pinned to one commit, one file at a time from raw.githubusercontent.com, every file recorded
// with its URL, sha256 and size, cached on disk so that a later run (`--offline`) reproduces the output without the network.
// The only other request is one call to api.github.com that turns a tag / branch into a commit id (skipped for a 40-hex ref).

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export const DEFAULT_REPO = 'gorhill/uBlock';
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const HOSTS = new Set(['raw.githubusercontent.com', 'api.github.com']);
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const MANIFEST = 'upstream.json';

export const sha256 = buf => createHash('sha256').update(buf).digest('hex');

export class SourceError extends Error {}

function safeRel(path) {
  if (typeof path !== 'string' || path === '' || path.startsWith('/') || path.split('/').some(s => s === '..' || s === '' || s === '.')) {
    throw new SourceError('bad source path ' + JSON.stringify(path));
  }
  return path;
}

async function httpGet(url, { fetchImpl = globalThis.fetch, headers = {}, retries = 3, timeoutMs = 30000, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !HOSTS.has(u.hostname)) throw new SourceError('refusing to fetch ' + url);
  let last;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': 'ubo-resources-converter', ...headers }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) throw new SourceError('404 for ' + url);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) throw new SourceError(url + ' is larger than ' + MAX_FILE_BYTES + ' bytes');
      return buf;
    } catch (e) {
      last = e;
      if (e instanceof SourceError) throw e;
      if (attempt + 1 < retries) await sleep(500 * 2 ** attempt);
    }
  }
  throw new SourceError('could not fetch ' + url + ': ' + (last && last.message));
}

export async function resolveCommit(repo, ref, opts = {}) {
  if (SHA_RE.test(ref)) return ref;
  const headers = { Accept: 'application/vnd.github.sha' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const url = 'https://api.github.com/repos/' + repo + '/commits/' + ref.split('/').map(encodeURIComponent).join('/');
  const sha = (await httpGet(url, { ...opts, headers })).toString('utf8').trim();
  if (!SHA_RE.test(sha)) throw new SourceError('GitHub did not return a commit id for ' + ref);
  return sha;
}

/**
 * A set of upstream files at one commit.  `read(path)` returns a Buffer and records the file.
 * Online: downloads (or reuses the cache when it holds the same commit).  Offline: only the cache, verified against its manifest.
 */
export class Sources {
  constructor(o) {
    Object.assign(this, o);
    this.used = new Map(); // path -> { path, url, sha256, size }
    this.known = new Map(); // manifest entries of the cache
  }

  static async open({ repo = DEFAULT_REPO, ref, cacheDir, offline = false, fetchImpl, sleep, log = () => {} }) {
    if (!REPO_RE.test(repo)) throw new SourceError('bad repository name ' + repo);
    if (!cacheDir) throw new SourceError('a cache directory is required');
    cacheDir = resolve(cacheDir);
    let manifest = null;
    try { manifest = JSON.parse(await readFile(join(cacheDir, MANIFEST), 'utf8')); } catch { /* none yet */ }
    if (offline) {
      if (!manifest) throw new SourceError('--offline: ' + join(cacheDir, MANIFEST) + ' is missing or unreadable');
      if (manifest.repo !== repo && repo !== DEFAULT_REPO) throw new SourceError('--offline: cache is for ' + manifest.repo + ', not ' + repo);
      if (ref && ref !== manifest.ref && ref !== manifest.commit) throw new SourceError('--offline: cache holds ' + manifest.ref + ' (' + manifest.commit + '), not ' + ref);
      const s = new Sources({ repo: manifest.repo, ref: manifest.ref, commit: manifest.commit, cacheDir, offline: true, fetchImpl, sleep, log });
      for (const f of manifest.files) s.known.set(f.path, f);
      return s;
    }
    if (!ref) throw new SourceError('--ref is required');
    const commit = await resolveCommit(repo, ref, { fetchImpl, sleep });
    log('resolved ' + repo + '@' + ref + ' -> ' + commit);
    const s = new Sources({ repo, ref, commit, cacheDir, offline: false, fetchImpl, sleep, log });
    if (manifest && manifest.repo === repo && manifest.commit === commit) for (const f of manifest.files) s.known.set(f.path, f);
    else await rm(join(cacheDir, 'files'), { recursive: true, force: true });
    return s;
  }

  rawUrl(path) { return 'https://raw.githubusercontent.com/' + this.repo + '/' + this.commit + '/' + path; }

  async read(path) {
    safeRel(path);
    const local = join(this.cacheDir, 'files', ...path.split('/'));
    if (!resolve(local).startsWith(join(this.cacheDir, 'files') + sep)) throw new SourceError('path escapes the cache: ' + path);
    const known = this.known.get(path);
    let buf = null;
    if (known) {
      try { buf = await readFile(local); } catch { buf = null; }
      if (buf && sha256(buf) !== known.sha256) {
        if (this.offline) throw new SourceError('cache file ' + path + ' does not match its recorded sha256');
        buf = null; // damaged cache entry: download again
      }
    }
    if (!buf) {
      if (this.offline) throw new SourceError('--offline: ' + path + ' is not in the cache');
      this.log('download ' + path);
      buf = await httpGet(this.rawUrl(path), { fetchImpl: this.fetchImpl, sleep: this.sleep });
      await mkdir(dirname(local), { recursive: true });
      await writeFile(local, buf);
      this.known.set(path, { path, url: this.rawUrl(path), sha256: sha256(buf), size: buf.length });
    }
    const rec = known && !this.offline ? this.known.get(path) : this.known.get(path);
    this.used.set(path, { path, url: rec.url, sha256: rec.sha256, size: rec.size });
    return buf;
  }

  /** The files read so far, sorted by path (this list, not the cache's, is what the output meta records). */
  files() { return [...this.used.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)); }

  /** Persist which files this run used, so `--offline` can reproduce it. */
  async saveManifest() {
    if (this.offline) return;
    await mkdir(this.cacheDir, { recursive: true });
    const doc = { repo: this.repo, ref: this.ref, commit: this.commit, files: this.files() };
    await writeFile(join(this.cacheDir, MANIFEST), JSON.stringify(doc, null, 2) + '\n');
  }
}

export async function exists(p) { try { await stat(p); return true; } catch { return false; } }
