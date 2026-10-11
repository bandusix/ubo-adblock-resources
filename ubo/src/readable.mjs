// SPDX-License-Identifier: GPL-3.0-or-later
// A human-reviewable rendering of ubo-resources.json: every text resource as its own file (so that a pull request diff shows
// the script source, not base64), binary resources only as a row (name, sha256, size).  Deterministic: sorted, LF only.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const TEXT_MIMES = new Set(['text/css', 'text/html', 'application/javascript', 'application/json', 'text/plain', 'text/xml', 'fn/javascript']);
const JS_LIKE = new Set(['application/javascript', 'fn/javascript']);
export const READABLE_DIRS = ['scriptlets', 'helpers', 'redirects'];
export const HEADER_PREFIX = '// ubo-resources: ';

const isTemplate = r => r.kind === 'template';
const mimeOf = r => (isTemplate(r) ? 'application/javascript' : r.kind.mime);
export const isTextResource = r => isTemplate(r) || TEXT_MIMES.has(r.kind.mime);

/** Which sub-directory a resource lands in. */
export function groupOf(r) {
  if (isTemplate(r)) return 'scriptlets';
  if (r.kind.mime === 'fn/javascript') return 'helpers';
  return 'redirects';
}

/** File name inside the group directory: names without a usable extension get `.js` / `.txt` so that editors and diff tools behave. */
export function fileNameOf(r) {
  if (r.kind === 'template' || r.kind.mime === 'fn/javascript') return r.name.endsWith('.js') ? r.name : r.name + '.js';
  return r.name;
}

const decode = r => Buffer.from(r.content, 'base64');
const sha = buf => createHash('sha256').update(buf).digest('hex');

export function headerFor(r) {
  const lines = [HEADER_PREFIX + 'name=' + r.name, HEADER_PREFIX + 'kind=' + (isTemplate(r) ? 'template' : r.kind.mime)];
  if (r.aliases && r.aliases.length) lines.push(HEADER_PREFIX + 'aliases=' + r.aliases.join(' '));
  if (r.dependencies && r.dependencies.length) lines.push(HEADER_PREFIX + 'dependencies=' + r.dependencies.join(' '));
  if (r.permission) lines.push(HEADER_PREFIX + 'permission=' + r.permission);
  return lines.join('\n') + '\n\n';
}

/** @returns Map<relative path, Buffer> of everything that would be written (so tests can check without a file system). */
export function renderReadable(resources) {
  const files = new Map();
  const rows = [];
  const sorted = resources.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const r of sorted) {
    const bytes = decode(r);
    const mime = mimeOf(r);
    const group = groupOf(r);
    let rel = '';
    if (isTextResource(r)) {
      let text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
      rel = group + '/' + fileNameOf(r);
      const js = JS_LIKE.has(mime) || isTemplate(r);
      files.set(rel, Buffer.from((js ? headerFor(r) : '') + text, 'utf8'));
      if (!js && r.aliases && r.aliases.length) files.set(rel + '.aliases', Buffer.from(r.aliases.join('\n') + '\n', 'utf8'));
    }
    rows.push([
      rel || '(binary, not written)', r.name, isTemplate(r) ? 'template' : r.kind.mime, (r.aliases || []).join(' '),
      (r.dependencies || []).join(' '), String(r.permission || 0), sha(bytes), String(bytes.length),
    ].join('\t'));
  }
  const head = ['file', 'name', 'kind', 'aliases', 'dependencies', 'permission', 'sha256_of_decoded_content', 'decoded_bytes'].join('\t');
  files.set('INDEX.tsv', Buffer.from(head + '\n' + rows.join('\n') + '\n', 'utf8'));
  return files;
}

export async function writeReadable(resources, dir) {
  const files = renderReadable(resources);
  for (const d of READABLE_DIRS) await rm(join(dir, d), { recursive: true, force: true });
  await rm(join(dir, 'INDEX.tsv'), { force: true });
  for (const [rel, buf] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const p = join(dir, ...rel.split('/'));
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, buf);
  }
  return files.size;
}
