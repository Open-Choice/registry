# registry

The Open Choice plugin registry. Hosts a signed `manifest.json` that the Open Choice app fetches to discover installable plugins.

Published at **https://registry.openchoice.app/manifest.json**.

## How it works

`manifest.json` at the root of this repo is the authoritative plugin list. It is signed with the `oc-registry-2026` Ed25519 key, whose public half is compiled into the Open Choice app as a first-party trusted key. The app verifies the signature before parsing any registry content.

Trust flows one way: the **private key never lives in the registry**, and the **public key never lives in the registry**. The registry only holds the signed payload. The app is the root of trust.

## Adding a plugin

1. Run the add-plugin script with the required fields:

```sh
node scripts/add-plugin.js \
  --plugin-id      com.example.my-plugin \
  --name           "My Plugin" \
  --description    "Does something useful" \
  --version        1.0.0 \
  --download-url   https://github.com/example/my-plugin/releases/download/v1.0.0/my-plugin-windows-x86_64.zip \
  --sha256         <64-char hex> \
  --signature-url  https://github.com/example/my-plugin/releases/download/v1.0.0/my-plugin-windows-x86_64.zip.sig \
  --public-key-id  my-plugin-2026 \
  --platform       windows-x86_64
```

This writes a draft entry to `plugins-pending/`.

2. Open a pull request. On merge, the GitHub Actions `publish.yml` workflow regenerates and re-signs `manifest.json` automatically.

## Signing locally

To regenerate the manifest outside of CI (e.g. for testing):

```sh
OC_REGISTRY_KEY=<64-char hex private key> node scripts/sign-manifest.js
```

Or pass the key file directly:

```sh
node scripts/sign-manifest.js --key-file path/to/oc-registry-2026.key
```

The key file must NOT be committed — `*.key` is in `.gitignore`.

## manifest.json structure

```json
{
  "schema_version": "1",
  "generated_at": "...",
  "plugins": [ ... ],
  "signature": "<base64 Ed25519>",
  "signed_by": "oc-registry-2026"
}
```

See the [Registry Format spec](https://openchoice.app/docs/plugins/registry-format/) for the full schema.

## Repository layout

```
manifest.json          # signed plugin list (auto-generated, do not hand-edit)
plugins/               # source of truth for accepted plugin entries
plugins-pending/       # staging area for new submissions (merged via PR)
scripts/
  add-plugin.js        # validates and stages a new plugin entry
  sign-manifest.js     # regenerates and signs manifest.json
  generate-pages.js    # renders per-plugin HTML pages served alongside the manifest
  commit-registry.ps1  # local helper for committing registry updates after a publish
.github/workflows/
  publish.yml          # signs and commits manifest.json on merge to main
CNAME                  # custom-domain alias for GitHub Pages (registry.openchoice.app)
```

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or <http://opensource.org/licenses/MIT>)

at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this repository by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

Copyright (c) 2026 The Open Choice Authors.
