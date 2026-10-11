#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// node src/cli.mjs --ref <tag|commit> --out <dir> [--state <previous meta.json>] [--cache <dir>] [--offline <cache dir>] [--readable <dir>] [--repo owner/name]

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Sources, DEFAULT_REPO } from './sources.mjs';
import { convert, serialize, LICENSE_PATH } from './convert.mjs';
import { buildMeta, diffMeta, isUnchanged, resourceDigests } from './meta.mjs';
import { detectNotice } from './license.mjs';
import { writeReadable } from './readable.mjs';
import { OUTPUT_FILE, META_FILE, CONVERTER_VERSION } from './version.mjs';

const USAGE = `usage: node src/cli.mjs --ref <uBO tag or commit> --out <dir> [options]
  --ref <ref>        upstream release tag, branch or 40-hex commit (required unless --offline)
  --out <dir>        where ${OUTPUT_FILE} and ${META_FILE} are written
  --state <file>     the ${META_FILE} of the previous run; nothing is rewritten when upstream files and converter are unchanged
  --cache <dir>      where downloaded upstream files are kept (default: <out>/.upstream-cache)
  --offline <dir>    reproduce from a cache directory written by an earlier run; no network
  --readable <dir>   also write every text resource as its own file (for review diffs)
  --repo <o/n>       upstream repository (default ${DEFAULT_REPO})
`;

const sha = buf => createHash('sha256').update(buf).digest('hex');
const exists = async p => { try { await stat(p); return true; } catch { return false; } };

export async function run(argv, { log = m => console.log(m), fetchImpl, sleep } = {}) {
  const { values: v } = parseArgs({
    args: argv,
    options: {
      ref: { type: 'string' }, out: { type: 'string' }, state: { type: 'string' }, cache: { type: 'string' },
      offline: { type: 'string' }, readable: { type: 'string' }, repo: { type: 'string' }, help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (v.help) { log(USAGE); return 0; }
  if (!v.out) throw new Error('--out is required\n' + USAGE);
  if (!v.ref && !v.offline) throw new Error('--ref is required (or --offline <cache dir>)\n' + USAGE);
  const out = resolve(v.out);
  const cacheDir = v.offline ? resolve(v.offline) : resolve(v.cache || join(out, '.upstream-cache'));

  let prev = null;
  if (v.state) {
    try { prev = JSON.parse(await readFile(v.state, 'utf8')); } catch (e) {
      if (e.code !== 'ENOENT') throw new Error('cannot read --state ' + v.state + ': ' + e.message);
      log('state file ' + v.state + ' does not exist yet: treating this as a first run');
    }
  }

  const src = await Sources.open({ repo: v.repo || DEFAULT_REPO, ref: v.ref, cacheDir, offline: !!v.offline, fetchImpl, sleep, log: m => log('  ' + m) });
  const notices = new Map();
  const read = async p => {
    const buf = await src.read(p);
    if (!notices.has(p)) notices.set(p, detectNotice(p, buf));
    return buf;
  };
  const { resources, info } = await convert(read);
  const licenseText = await read(LICENSE_PATH); // the upstream licence text: recorded (and cached) with the sources
  if (!/GNU GENERAL PUBLIC LICENSE[\s\S]{0,40}Version 3/i.test(licenseText.toString('utf8'))) throw new Error('upstream ' + LICENSE_PATH + ' is not the GPL-3.0 text any more: check the licence before publishing');
  await src.saveManifest();
  const files = src.files().map(f => ({ ...f, license_notice: notices.get(f.path).notice, copyright: notices.get(f.path).copyright }));

  if (isUnchanged(prev, files)) {
    const outFile = join(out, OUTPUT_FILE);
    if (await exists(outFile) && sha(await readFile(outFile)) === prev.output.sha256) {
      log('unchanged: upstream files (' + files.length + ') and converter ' + CONVERTER_VERSION + ' are the same as in ' + v.state + (prev.upstream.commit !== src.commit ? '; upstream moved from ' + prev.upstream.commit.slice(0, 12) + ' to ' + src.commit.slice(0, 12) + ' without touching them' : ''));
      if (v.readable && !(await exists(join(resolve(v.readable), 'INDEX.tsv')))) {
        const n = await writeReadable(JSON.parse(await readFile(outFile, 'utf8')), resolve(v.readable));
        log('readable view was missing: wrote ' + n + ' files to ' + v.readable);
      }
      return 0;
    }
    log('state says unchanged but ' + outFile + ' is missing or differs from the recorded sha256: converting again');
  }

  const bytes = serialize(resources);
  const digests = resourceDigests(resources, r => serialize([r]).toString('utf8'));
  const meta = buildMeta({ repo: src.repo, ref: src.ref, commit: src.commit, files, resources, info, outputBytes: bytes, digests });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, OUTPUT_FILE), bytes);
  await writeFile(join(out, META_FILE), JSON.stringify(meta, null, 2) + '\n');
  if (v.readable) {
    const n = await writeReadable(resources, resolve(v.readable));
    log('readable view: ' + n + ' files in ' + v.readable);
  }
  log('changed:');
  for (const l of diffMeta(prev, meta).lines) log('  ' + l);
  log('wrote ' + join(out, OUTPUT_FILE) + ' (' + bytes.length + ' bytes, ' + resources.length + ' resources: ' + info.scriptlets + ' scriptlets, ' + info.helpers + ' helpers, ' + info.redirects + ' redirects) and ' + META_FILE);
  if (info.warnings.length) for (const w of info.warnings) log('warning: ' + w);
  return 0;
}

const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  run(process.argv.slice(2)).then(c => process.exit(c), e => { console.error('error: ' + e.message); process.exit(1); });
}
