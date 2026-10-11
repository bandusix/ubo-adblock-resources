# ubo-resources-converter

Turns **uBlock Origin's scriptlets and redirect resources** into the JSON that Brave's **adblock-rust** engine loads
(`Engine::use_resources`, an array of `Resource` objects).  Brave's own `dist/resources.json` only contains Brave's own scripts; the uBO
scriptlet library (`set-constant`, `abort-on-property-read`, `json-prune` ...) and the replacement resources (`noop.js`, `1x1.gif`,
`google-analytics_ga.js` ...) have to come from uBlock Origin itself.  This tool does that conversion.

* node >= 20, **no npm dependencies**, one process, no build step.
* **Nothing downloaded is ever executed.**  uBO's scriptlets are ES modules; they are read with a small JavaScript tokenizer
  (`src/jslex.mjs`, `src/jsmodule.mjs`): declarations are cut out with their exact source text (what `Function.prototype.toString()` would
  return), registrations are read as literals.  Anything it cannot read is an error, never a guess.
* **Deterministic**: the same upstream files give the same bytes (sorted, no timestamps, LF).
* **Incremental**: pass the previous `ubo-resources.meta.json` as `--state` and an unchanged upstream is reported as `unchanged` without writing a file;
  a changed one prints which resources were added, removed or changed.
* **Reviewable**: `--readable <dir>` also writes every script as its own file, so a pull request shows source diffs instead of base64.

```
node src/cli.mjs --ref 1.75.0 --out out                                         # download (raw.githubusercontent.com), convert
node src/cli.mjs --ref 1.75.0 --out out --state out/ubo-resources.meta.json     # ... and say "unchanged" if nothing moved
node src/cli.mjs --offline .upstream-cache --out out                            # reproduce from files downloaded earlier, no network
node src/cli.mjs --ref 1.75.0 --out out --readable out/readable                 # + one file per script / redirect resource
npm test                                                                         # offline, fixture based (67 tests)
npm run mutate                                                                   # mutation check of the test suite
cargo run --release --manifest-path verify-rs/Cargo.toml -- out/ubo-resources.json   # load it into the real engine (optional)
```

## Options

| option | meaning |
|---|---|
| `--ref <tag \| branch \| 40-hex commit>` | upstream version.  A tag or branch is resolved to a commit with **one** call to `api.github.com/repos/<repo>/commits/<ref>` (`GITHUB_TOKEN` is used if set); a full commit id needs no API call.  Every file is then fetched at that commit, so a result never mixes two versions |
| `--out <dir>` | receives `ubo-resources.json` and `ubo-resources.meta.json` |
| `--state <file>` | the meta of the previous run.  Same upstream source files (path + sha256), same converter version, output file intact -> prints `unchanged: ...`, writes nothing.  A missing file counts as "first run"; a corrupt one is an error |
| `--cache <dir>` | where downloaded upstream files are kept (default `<out>/.upstream-cache`): `upstream.json` (repo, ref, commit, every file with URL, sha256, size) and `files/<path>`.  Reused when it holds the same commit |
| `--offline <dir>` | use such a cache and nothing else; every file is checked against the recorded sha256 |
| `--readable <dir>` | review tree: `scriptlets/`, `helpers/`, `redirects/`, `INDEX.tsv` (see below) |
| `--repo owner/name` | default `gorhill/uBlock` |

Only two hosts are ever contacted, over https: `raw.githubusercontent.com` (the files) and `api.github.com` (ref -> commit).  Files over 4 MiB are refused.

## Which upstream files are read

Starting from two entry points, following `import` statements (relative paths only):

* `src/js/resources/scriptlets.js` and everything it imports (`src/js/resources/*.js`, plus `src/js/arglist-parser.js`, `src/js/jsonpath.js`,
  `src/js/urlskip.js` which uBO's own `shared.js` / `href-sanitizer.js` import);
* `src/js/redirect-resources.js` (the `new Map([...])` of redirect resources) and, for each entry, `src/web_accessible_resources/<name>`;
* `LICENSE.txt` (recorded, and checked to still be the GPL-3 text: if upstream's licence ever changes, the run fails).

For 1.75.0 that is 83 files, 486,484 bytes.  The list is in `ubo-resources.meta.json` (`files[]`), not in this README.

## Output

`ubo-resources.json`: a JSON array, one resource per line, sorted by `name`, fields in a fixed order:
`{"name", "aliases", "kind", "content", "dependencies"?, "permission"?}`  (the shape of `adblock::resources::Resource`; `content` is base64).

| uBO | resource | `kind` |
|---|---|---|
| scriptlet, e.g. `abort-on-property-read.js` (aliases `aopr.js`) | **function-style template**: `content` is the function's source, `dependencies` the helpers it needs | `"template"` (injectable, **not** a redirect target) |
| helper function / class, e.g. `safe-self.fn`, `arglist-parser.fn` | text of the declaration | `{"mime":"fn/javascript"}` |
| file in `web_accessible_resources`, e.g. `noop.js`, `1x1.gif` (+ `alias`) | the file | `{"mime": ...}` from the extension: `application/javascript`, `text/css`, `text/html`, `application/json`, `text/plain`, `text/xml`, `image/gif`, `image/png`, `audio/mp3`, `video/mp4` (uBO's `text/javascript` becomes `application/javascript`, the only spelling the engine knows).  `empty` -> `text/plain`, empty content |
| `requiresTrust: true` (scriptlet or redirect) | `permission: 1` | Brave's convention: its list catalogue gives every trusted list `permission_mask: 1` |

How adblock-rust 0.13 uses a function-style scriptlet (`resources/resource_storage.rs`): for a rule `site##+js(name, a, b)` it emits the text of every
transitive dependency, then the scriptlet's own text, then `functionName("a", "b")` inside `try { } catch ( e ) { }`.  That is the shape uBO itself
assembles (`fn.toString()` + dependency names + a call), so **no `{{1}}` placeholders and no `eval`** are involved.  Consequences handled here:

* The engine requires the text to start with `function NAME(`; the converter checks it for every scriptlet and also that the name matches the declaration.
* uBO scriptlets read a free variable `scriptletGlobals` ("externally added to the private namespace in which scriptlets execute").  The converter adds one
  helper, **`scriptlet-globals.fn`** (`var scriptletGlobals = ...{}`), as a dependency of every resource that mentions it (`safe-self.fn` and `prevent-xhr.fn`
  among them).  Without it `safeSelf()` throws and nearly every scriptlet fails *silently* inside the engine's `try/catch`.
* The engine emits plain top-level code, so function declarations become globals.  **Run the engine's `injected_script` inside a function scope**
  (`(function(){ ... })()`); it also keeps `class` helpers (which cannot be declared twice) from clashing if a script is injected twice.
* Names and aliases share one table in the engine (a clash silently drops the second resource).  The converter fails on any clash instead.
* A missing dependency makes the engine skip the **whole** scriptlet without an error.  The converter checks every dependency name, and warns about a function that
  calls another registered function without declaring it (`warnings[]` in the meta; at 1.75.0 the one warning is `proxy-apply-config.js`, which is guarded by `typeof` on purpose).

What is **not** carried over, and why (all listed in the meta where it matters):

* `click2load.html` (redirect resource with `params`): the engine cannot pass request data to a resource; adblock-rust's own assembler skips these too -> `skipped[]`.
* `world: 'ISOLATED'` (22 scriptlets): an extension-only notion; they only use DOM / storage APIs and run fine in the page's main world.  Recorded as `isolated_world_in_upstream`.
* `priority` (e.g. `proxy-apply-config.js`): the engine has no injection ordering.
* A redirect resource with a permission (`google-ima-dai.js`) can never be a redirect in adblock-rust (it refuses permissioned resources for redirects): such a rule degrades to a plain block.
* For text redirect resources uBO's own GPL header comment is removed (as uBO does when it serves them); **attributions of third-party code are kept** (`google-ima.js` keeps its "based on Mozilla source code" block).  Licence facts live in the meta instead (below).

## `ubo-resources.meta.json`

Upstream repository, `ref`, resolved `commit`, `license` (`GPL-3.0-or-later`), `license_url` of the upstream licence at that commit, the notice
*"Runtime data downloaded from the rules CDN ... NOT distributed with the application binary or the native module"*, converter name + version,
the output file's sha256 / size / counts, the list of trusted resources, `skipped[]`, `warnings[]`, a sha256 per resource (`resources`, used for the change summary) and
`files[]`: **every upstream file with URL, sha256, size, and the licence notice found in its header** (`license_notice`, `copyright`).

## `--readable`

```
scriptlets/abort-on-property-read.js     the scriptlet's source, after a header of  // ubo-resources: name= kind= aliases= dependencies= permission=
helpers/safe-self.fn.js                   helper functions / classes (same header)
redirects/noop.js, noop.html, ...         text redirect resources (JS gets the header; other text has a sibling  <name>.aliases  file)
INDEX.tsv                                 every resource: file, name, kind, aliases, dependencies, permission, sha256 and size of the decoded content
```

Binary resources (gif, png, mp3, mp4) are only listed in `INDEX.tsv`.  Deterministic: sorted, LF only; stale files in these directories are removed, other files in `<dir>` are left alone.
Stripping the header lines (up to the first empty line) gives exactly the decoded `content`.

## Tests

* `npm test`: 67 offline tests (`node:test`) on fixtures in `test/fixtures/upstream/` (small files **written for this repository** that imitate the shape of uBO's modules:
  import aliases, class helpers, `builtinScriptlets.push` before the declaration, regex literals with quotes and braces, nested template literals ...).  Golden output in
  `test/fixtures/expected/` (`UPDATE_GOLDEN=1 npm test` after an intended change; bump `CONVERTER_VERSION` in `src/version.mjs` whenever the output for the same input changes).
  The network is faked; nothing is downloaded.
* `npm run mutate`: copies the converter, breaks one thing at a time (a lost alias, a missing dependency, the shim, a wrong MIME, a dropped permission, a truncated function,
  a cache that is not verified ...) and requires the suite to go red: **32 mutants, 32 killed** (the first run had one survivor: an incremental check that ignored file hashes; a test was added).
* `verify-rs/` (optional, needs a Rust toolchain and the `adblock` crate): loads the output into the real engine and requires that every element deserializes and is accepted by
  `InMemoryResourceStorage::add_resource` (`Engine::use_resources` swallows rejections silently), that **every scriptlet name and alias** yields an `injected_script` that calls the function and
  contains its dependencies' text (empty exactly when the permission is missing), and that **every redirect name and alias** returns a `data:` URL with the right MIME and bytes.
  `--perm N` sets the permission mask of the rules (default 3).  `adblock` is pinned to `=0.13.3`.

## Upstream version policy

* Pin **release tags** (`1.75.0`), never a moving branch, in anything that ships: the meta records the tag *and* the commit, and the files are fetched by commit.
* A daily job (see `examples/github-actions-update.yml`, a sketch that has not been run) resolves the newest release, converts with `--state`, and only when something changed
  runs `verify-rs` and opens a pull request whose body is the change summary and whose diff is `out/readable/`.  Beta tags (`1.75.1b10`) are not releases and are skipped by `/releases/latest`.
* If upstream changes its module layout, the run **fails with the reason** (an unreadable registration, a scriptlet that is not a named function, a name clash, a missing import ...) instead of
  producing a smaller output; read the error, extend `src/jsmodule.mjs` / `src/scriptlets.mjs`, add a fixture, bump the converter version.

## Licence facts (uBlock Origin 1.75.0, commit 21f0e686506bb21b514b451c8c6cb9bf8c82d232)

* Upstream licence: GPL-3.0-or-later (`LICENSE.txt` at the commit above; source headers say "either version 3 of the License, or (at your option) any later version").
  https://github.com/gorhill/uBlock/blob/21f0e686506bb21b514b451c8c6cb9bf8c82d232/LICENSE.txt
* Of the 83 files read: 60 carry the uBO GPL-3.0-or-later header; 1 is the licence text; 7 are binary (no place for a notice); **13 are tiny placeholder files or one-liners without any
  notice** (`noop.js`, `noop.css`, `noop.html`, `noop.json`, `noop.txt`, `empty`, `noop-vast{2,3,4}.xml`, `noop-vmap1.xml`, `adthrive_abd.js`, `doubleclick_instream_ad_status.js`, `piano-analytics.js`);
  **`google-ima.js` (15 KB) is "based on Mozilla source code"** (Mozilla's web-compat shims; an attribution block is in the file and is kept, no licence is stated);
  **`google-ima-dai.js` (32 KB) is code from AdGuard Scriptlets, GPLv3 according to its own header** (kept in the content).  The per-file facts are in the meta (`files[].license_notice`).
* The output is GPL-3.0-or-later data.  The converter's own code is declared GPL-3.0-or-later for now (see `LICENSE`).  adblock-rust (MPL-2.0) is not part of this directory.
* The output is meant to be **downloaded at run time**, not shipped inside an application binary or a native library.

## Known limits

* Written against the module layout of uBO 1.75.0.  Other layouts are detected, not guessed (see above), but not predicted.
* `import` forms outside what uBO uses (`import * as`, `export *`, dynamic `import()`) are refused.
* Regular expression literals are recognised by the usual "what came before the slash" rule; a pathological upstream construct could confuse it.  Safety nets: every scriptlet, helper and
  JavaScript redirect resource is **compiled** (`new vm.Script`, which parses and never runs anything) and must be valid JavaScript; `verify-rs` checks the engine's view of every resource.
  Behaviour (what a scriptlet *does* in a page) is not tested by this directory: that needs a DOM stand-in and the engine, and belongs to the application that embeds the output.
* Output size at 1.75.0: 438,056 bytes (104,366 gzip); the largest parts are the scriptlets (JSON editing, `prevent-xhr`, cookies) and `google-ima-dai.js` / `google-ima.js`.
