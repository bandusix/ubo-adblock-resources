# Initial import: uBlock Origin 1.75.0

First conversion, produced offline from the pinned upstream files (uBlock Origin `1.75.0`, commit
`21f0e686506bb21b514b451c8c6cb9bf8c82d232`), 83 source files, every file recorded with its URL and SHA-256 in
`ubo-resources.meta.json`.

* 198 resources: 98 scriptlets, 54 helper functions, 46 redirect resources (34 of them require the `trusted` permission).
* Decoded sources for review are in `readable/` (`scriptlets/`, `helpers/`, `redirects/`; binaries are listed with SHA-256 in `readable/INDEX.tsv`).
* Accepted by the real `adblock-rust` 0.13.3 engine with 0 rejected (see `ubo/verify-rs`).

Later releases replace this file with the added / removed / changed resources between two upstream releases.
