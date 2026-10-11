// SPDX-License-Identifier: GPL-3.0-or-later
// Which licence does a source file state about itself?  Recorded per file in the meta so that a human can see at a glance which
// upstream files carry a notice and which (tiny placeholder files, images) do not.

const BINARY_EXT = /\.(gif|png|mp3|mp4)$/;

/** @returns {{notice: string, copyright: string|null}}  notice: an SPDX id, 'binary (no place for a notice)', or 'none found' */
export function detectNotice(path, buf) {
  if (BINARY_EXT.test(path)) return { notice: 'binary (no place for a notice)', copyright: null };
  const head = Buffer.from(buf).subarray(0, 4096).toString('utf8');
  const copyright = (/Copyright \(C\)[^\n*]*/.exec(head) || [null])[0];
  if (path === 'LICENSE.txt') return { notice: 'licence text', copyright };
  if (/github\.com\/AdguardTeam\/Scriptlets/.test(head) && /GPLv3/.test(head)) return { notice: 'GPL-3.0 (stated in the header as "GPLv3"; code from AdGuard Scriptlets)', copyright };
  if (/based on Mozilla source code/.test(head)) return { notice: 'none found (header says: based on Mozilla source code)', copyright };
  if (/GNU General Public License[\s\S]{0,400}version 3[\s\S]{0,200}any later version/i.test(head)) return { notice: 'GPL-3.0-or-later', copyright };
  if (/GNU General Public License[\s\S]{0,400}version 3/i.test(head)) return { notice: 'GPL-3.0-only', copyright };
  if (/Mozilla Public License/i.test(head)) return { notice: 'MPL-2.0', copyright };
  if (/SPDX-License-Identifier:\s*([^\s*]+)/.test(head)) return { notice: RegExp.$1, copyright };
  return { notice: 'none found', copyright };
}
