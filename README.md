# ubo-adblock-resources

Converts the scriptlets and redirect resources of [uBlock Origin](https://github.com/gorhill/uBlock) into the
[`adblock-rust`](https://github.com/brave/adblock-rust) `Resource` JSON format, and republishes the result as
**unsigned, reviewable data** whenever uBlock Origin ships a new release.

> Not affiliated with, endorsed by, or sponsored by Raymond Hill, the uBlock Origin project, or Brave Software.
> Product names are used only to describe compatibility.

## Why a separate repository

* The converted data is derived from uBlock Origin (GPL-3.0-or-later). This repository is its **corresponding source**:
  the converter, the exact upstream files it was built from (pinned by commit and SHA-256), and every generated file.
* Applications that consume the data download it at runtime; none of it is bundled into an application binary.
* Everything that decides what ends up in users' pages is reviewable here, in the open.

## How it works

```
daily cron ──► resolve latest uBO release tag ──► convert (incremental: no-op if nothing changed)
          ──► unit tests + engine acceptance (adblock-rust accepts every resource)
          ──► open a PR with a readable diff (decoded scripts, added / removed / changed resources)
human review ─► merge ─► release workflow ─► GitHub Release: ubo-resources.json(.gz), meta, SHA256SUMS, provenance attestation
```

* **Upstream releases only.** Never `master`. A new uBO tag is the only thing that triggers a conversion.
* **Nothing is published without a human merge.** The scheduled workflow can only open a pull request.
* **No secrets here.** This repository holds no signing keys and no third-party credentials. Releases are unsigned;
  consumers pin the SHA-256 of the release they reviewed and sign / distribute it on their own side.
* **Deterministic output.** The same upstream files and converter version always produce byte-identical files.
* GitHub Actions are pinned by commit SHA. Workflow permissions are the minimum each job needs.

## Layout

| Path | What |
|---|---|
| `ubo/` | the converter (Node, no npm dependencies), its offline tests, and `verify-rs/` (loads the result with the real `adblock-rust`) |
| `dist/` | the currently reviewed output: `ubo-resources.json`, `ubo-resources.meta.json`, `readable/` (decoded sources for review), `DIFF.md` |
| `.github/workflows/update.yml` | daily check → PR |
| `.github/workflows/release.yml` | on merge → Release |

## Consuming a release

1. Pick a release, read its `DIFF.md`, and record the SHA-256 of `ubo-resources.json` from `SHA256SUMS`.
2. In your build pipeline download the asset, **compare against the pinned hash**, then sign and distribute it yourself.
3. Optionally verify the provenance attestation: `gh attestation verify ubo-resources.json --repo <owner>/<repo>`.

`ubo-resources.meta.json` records the upstream repository, release tag and commit, every source file's URL, SHA-256 and
size, the converter version, resource counts and the licence.

## Running it locally

```bash
node ubo/src/cli.mjs --ref <uBO release tag> --out out --readable out/readable
cd ubo && node --test
cargo run --release --locked --manifest-path ubo/verify-rs/Cargo.toml -- out/ubo-resources.json
```

## Licence

`GPL-3.0-or-later`, because the generated data is derived from uBlock Origin. See `LICENSE` and the notices in
`ubo/README.md`. The upstream project's licence and copyright notices apply to the upstream-derived portions.

---

## 简介（中文）

把 uBlock Origin 的 scriptlet 与 redirect 资源转换成 `adblock-rust` 的 `Resource` JSON，并在 uBO 发布新版本时，
以**未签名、可审阅**的数据形式重新发布。

* 只跟上游**发布 tag**，不跟 `master`；每天检查，没有新版本就什么都不做。
* Action **只会开 PR**，不会直接发布；人工审核 PR（里面有解码后的脚本差异）并合并后才产生 Release。
* 本仓库**不持有任何签名密钥或凭据**；使用方固定自己审核过的 SHA-256，并在自己这边签名下发。
* 转换结果是 uBO 的衍生数据（GPL-3.0-or-later），本仓库即其对应源码；应用只在运行时下载数据，不打进应用二进制。
