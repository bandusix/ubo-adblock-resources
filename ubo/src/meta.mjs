// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';
import { CONVERTER_NAME, CONVERTER_VERSION, META_SCHEMA, OUTPUT_FILE } from './version.mjs';

const sha = buf => createHash('sha256').update(buf).digest('hex');

export const NOTICE = 'Runtime data downloaded from the rules CDN. It is converted from uBlock Origin (GPL-3.0-or-later) and is NOT distributed with the application binary or the native module; the engine that executes it (Brave adblock-rust, MPL-2.0) is a separate work.';

/** sha256 of each resource's own JSON text, keyed by name (used for the change summary). */
export function resourceDigests(resources, serializeOne) {
  const out = {};
  for (const r of resources) out[r.name] = sha(Buffer.from(serializeOne(r), 'utf8'));
  return out;
}

export function buildMeta({ repo, ref, commit, files, resources, info, outputBytes, digests }) {
  const kindCount = { scriptlets: info.scriptlets, helpers: info.helpers, redirects: info.redirects };
  return {
    schema: META_SCHEMA,
    converter: { name: CONVERTER_NAME, version: CONVERTER_VERSION },
    upstream: {
      repo: 'https://github.com/' + repo,
      ref,
      commit,
      license: 'GPL-3.0-or-later',
      license_url: 'https://github.com/' + repo + '/blob/' + commit + '/LICENSE.txt',
      homepage: 'https://github.com/' + repo,
    },
    license: 'GPL-3.0-or-later',
    notice: NOTICE,
    output: { file: OUTPUT_FILE, sha256: sha(outputBytes), bytes: outputBytes.length, count: resources.length, ...kindCount, trusted: info.trusted.length },
    files,
    trusted: info.trusted,
    isolated_world_in_upstream: info.isolatedWorld,
    skipped: info.skipped,
    warnings: info.warnings,
    resources: digests,
  };
}

/** What changed between two meta documents (the previous one may be null). */
export function diffMeta(prev, next) {
  const lines = [];
  const pr = (prev && prev.resources) || {};
  const nr = next.resources;
  const added = Object.keys(nr).filter(n => !(n in pr)).sort();
  const removed = Object.keys(pr).filter(n => !(n in nr)).sort();
  const changed = Object.keys(nr).filter(n => n in pr && pr[n] !== nr[n]).sort();
  const pf = new Map(((prev && prev.files) || []).map(f => [f.path, f.sha256]));
  const nf = new Map(next.files.map(f => [f.path, f.sha256]));
  const fAdded = [...nf.keys()].filter(p => !pf.has(p)).sort();
  const fRemoved = [...pf.keys()].filter(p => !nf.has(p)).sort();
  const fChanged = [...nf.keys()].filter(p => pf.has(p) && pf.get(p) !== nf.get(p)).sort();
  if (prev) {
    lines.push('upstream: ' + prev.upstream.ref + ' (' + prev.upstream.commit.slice(0, 12) + ') -> ' + next.upstream.ref + ' (' + next.upstream.commit.slice(0, 12) + ')');
    if (prev.converter.version !== next.converter.version) lines.push('converter: ' + prev.converter.version + ' -> ' + next.converter.version);
  }
  lines.push('resources: ' + Object.keys(nr).length + (prev ? ' (was ' + Object.keys(pr).length + ')' : ''));
  if (!prev) {
    lines.push('first conversion (no previous state): ' + added.length + ' resources from ' + next.files.length + ' source files');
    return { lines, added, removed, changed, any: true };
  }
  const list = (label, a) => { if (a.length) lines.push(label + ' (' + a.length + '): ' + a.join(', ')); };
  list('added', added);
  list('removed', removed);
  list('changed', changed);
  list('source files added', fAdded);
  list('source files removed', fRemoved);
  list('source files changed', fChanged);
  return { lines, added, removed, changed, any: !!(added.length || removed.length || changed.length) };
}

/** Same upstream files, same converter: nothing to do. */
export function isUnchanged(prev, files) {
  if (!prev || !prev.converter || prev.converter.version !== CONVERTER_VERSION || prev.schema !== META_SCHEMA) return false;
  if (!Array.isArray(prev.files) || prev.files.length !== files.length) return false;
  return files.every((f, i) => prev.files[i].path === f.path && prev.files[i].sha256 === f.sha256);
}
