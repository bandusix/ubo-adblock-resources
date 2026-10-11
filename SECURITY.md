# Security

## Threat model

The data this repository publishes is JavaScript that consuming applications may run inside web pages. A compromised
release could therefore be harmful, so the pipeline is built around making that hard and making it visible:

* No signing keys, deploy keys, or cloud credentials are stored in this repository or its Actions secrets.
  Consumers sign what they choose to distribute; this repository cannot sign on their behalf.
* The scheduled workflow can only open a pull request. A person must review and merge it before anything is released.
* Pull requests contain decoded, human-readable sources and a per-resource summary of what was added, removed or changed.
* Upstream input is limited to files from tagged uBlock Origin releases, fetched by URL and recorded with SHA-256.
* Releases carry a build-provenance attestation and `SHA256SUMS`; consumers should pin the SHA-256 they reviewed.

Recommended repository settings: require pull-request review on `main`, restrict who can push tags and create releases,
and turn on "Require approval for workflows from outside collaborators".

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository ("Security" tab → "Report a vulnerability").
Do not open a public issue for a suspected supply-chain problem.
