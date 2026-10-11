// SPDX-License-Identifier: GPL-3.0-or-later
// uBlock Origin's redirect resources: the map in src/js/redirect-resources.js (name -> {alias, data, params, requiresTrust}) plus the
// files in src/web_accessible_resources/ -> adblock-rust `Resource` objects (kind {mime}, base64 content).

import { tokenize, parseLiteral } from './jslex.mjs';

export class RedirectError extends Error {}

export const REDIRECT_MAP_PATH = 'src/js/redirect-resources.js';
export const WAR_DIR = 'src/web_accessible_resources/';

/** adblock-rust's MimeType enum can only express these; anything else would be stored as application/octet-stream. */
const EXT_MIME = new Map([
  ['css', 'text/css'], ['gif', 'image/gif'], ['html', 'text/html'], ['js', 'application/javascript'], ['json', 'application/json'],
  ['mp3', 'audio/mp3'], ['mp4', 'video/mp4'], ['png', 'image/png'], ['txt', 'text/plain'], ['xml', 'text/xml'],
]);
export const TEXT_MIMES = new Set(['text/css', 'text/html', 'application/javascript', 'application/json', 'text/plain', 'text/xml']);

/** uBO names a resource `empty` (no extension); its content is empty and it stands for "an empty response of any type". */
export function mimeForName(name) {
  const m = /\.([^.]+)$/.exec(name);
  if (!m) return name === 'empty' ? 'text/plain' : null;
  return EXT_MIME.get(m[1]) || null;
}

/** -> [{ name, aliases[], data, params, requiresTrust }] in file order */
export function parseRedirectMap(src) {
  const toks = tokenize(src);
  const i = toks.findIndex((t, k) => t.t === 'id' && t.v === 'Map' && toks[k + 1] && toks[k + 1].v === '(' && toks[k + 2] && toks[k + 2].v === '[');
  if (i < 0) throw new RedirectError('redirect-resources.js: cannot find `new Map([` (upstream format changed?)');
  const { value, next } = parseLiteral(toks, i + 2);
  if (!(toks[next] && toks[next].v === ')')) throw new RedirectError('redirect-resources.js: the Map([...]) call has more arguments than expected');
  const out = [];
  const seen = new Set();
  for (const e of value) {
    if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'string' || typeof e[1] !== 'object' || e[1] === null || Array.isArray(e[1])) {
      throw new RedirectError('redirect-resources.js: entry is not [name, {…}]');
    }
    const [name, d] = e;
    if (seen.has(name)) throw new RedirectError('redirect-resources.js: ' + name + ' appears twice');
    seen.add(name);
    const known = new Set(['alias', 'data', 'params', 'requiresTrust']);
    for (const k of Object.keys(d)) if (!known.has(k)) throw new RedirectError('redirect-resources.js: ' + name + ' has the unknown property `' + k + '`');
    const aliases = d.alias === undefined ? [] : Array.isArray(d.alias) ? d.alias : [d.alias];
    if (aliases.some(a => typeof a !== 'string' || a === '')) throw new RedirectError('redirect-resources.js: bad alias on ' + name);
    out.push({ name, aliases, data: d.data, params: d.params, requiresTrust: d.requiresTrust === true });
  }
  return out;
}

/**
 * uBO strips the top-of-file comment block from the text it serves (redirect-engine.js removeTopCommentBlock).  Same here, but only
 * when that block is uBO's own GPL header: a block that credits other code (google-ima.js is "based on Mozilla source code")
 * is an attribution and stays in the content.
 */
export function stripTopComment(text) {
  const m = /^\/\*[\S\s]+?\*\/\s*/.exec(text);
  if (!m) return text;
  return /GNU General Public License/.test(m[0]) && /Copyright \(C\)/.test(m[0]) ? text.slice(m[0].length) : text;
}

export function decodeText(buf, label) {
  let s;
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { throw new RedirectError(label + ': not valid UTF-8'); }
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r\n?/g, '\n');
}

/**
 * @param entries  parseRedirectMap() output
 * @param read     async (path) => Buffer
 * @returns { resources: [{name, aliases, kind, bytes: Buffer, requiresTrust, origin}], skipped: [{name, reason}] }
 */
export async function redirectResources(entries, read) {
  const resources = [];
  const skipped = [];
  for (const e of entries) {
    if (e.params !== undefined) {
      // adblock-rust has no way to pass the request's query parameters to a resource (its own assembler skips these too)
      skipped.push({ name: e.name, reason: 'declares `params` (needs request data adblock-rust cannot supply)' });
      continue;
    }
    const mime = mimeForName(e.name);
    if (mime === null) {
      skipped.push({ name: e.name, reason: 'no MIME type adblock-rust can express for this file name' });
      continue;
    }
    const path = WAR_DIR + e.name;
    let bytes = Buffer.from(await read(path));
    if (TEXT_MIMES.has(mime)) bytes = Buffer.from(stripTopComment(decodeText(bytes, path)), 'utf8');
    resources.push({ name: e.name, aliases: e.aliases.slice(), kind: { mime }, bytes, requiresTrust: e.requiresTrust, origin: path });
  }
  return { resources, skipped };
}
