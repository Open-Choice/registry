# Plugin Release Workflow

All plugins live in the **monorepo** at `Open-Choice/open-choice-plugins`. Releases are tag-based — one tag per plugin per version, like `toy-calculator-v0.1.1`.

---

## The happy path: one command

From the monorepo root:

```powershell
.\scripts\release-plugin.ps1 plugin-toy-calculator 0.1.1
```

That single script runs the full flow: bump version, commit, build + sign, tag, push, GitHub Release (with `.ocplugin` asset), stage registry entry, sign registry manifest, commit + push registry repo.

**Before running it**, make sure you have:

1. ✅ Written a `NEWS.md` entry at the top of `apps/<plugin>/NEWS.md`:
   ```markdown
   # <artifact-prefix> 0.1.1

   ## Bug fixes
   - Fixed divide-by-zero with single-zero operand list.

   ## New features
   - Added subtract operation.
   ```
   Header must be exactly `# <artifact-prefix> <version>`. The artifact prefix is the plugin name without any `plugin-` folder prefix (e.g. folder `plugin-toy-calculator` → artifact `toy-calculator`).

2. ✅ A clean git working tree (`git status` is empty).

3. ✅ `gh` CLI installed and authenticated (`gh auth login`).

4. ✅ Registry signing key at `%USERPROFILE%\.open-choice\keys\oc-registry-2026.key`.

---

## Preview first (recommended)

```powershell
.\scripts\release-preview.ps1 plugin-toy-calculator 0.1.1
```

Read-only. Reports the proposed version, tag, download URL, and shows whether the NEWS.md entry exists. Run this to sanity-check before `release-plugin.ps1`.

---

## Flags worth knowing

| Flag | Effect |
|---|---|
| `-DryRun` | Print every step with no writes, no commits, no pushes. |
| `-SkipPush` | Do all local work (bump, build, tag, stage registry, commit registry) but skip `git push` and `gh release create`. You push manually when you're happy. |
| `-SkipGhRelease` | Tag is still pushed, but no GitHub Release page is created and no artifact uploaded. Do that part by hand. |
| `-Force` | Skip the interactive "Continue with release? (y/N)" prompt. |

---

## What gets produced

- **Monorepo commit:** `Release <artifact-prefix> v<version>` touching `Cargo.toml`, `packaging/manifest.json`, `NEWS.md`.
- **Monorepo tag:** `<artifact-prefix>-v<version>` (annotated).
- **GitHub Release:** `https://github.com/Open-Choice/open-choice-plugins/releases/tag/<artifact-prefix>-v<version>` with the `.ocplugin` attached as an asset.
- **Registry entry:** appended to `manifest.json` in the registry repo, signed with `oc-registry-2026`, committed, pushed.

---

## Smaller tools (if you need to run steps manually)

| Script (in `open-choice-plugins/scripts/`) | What it does |
|---|---|
| `bump-version.ps1 <plugin> <version>` | Atomic bump of `Cargo.toml` + `packaging/manifest.json`. Fails if `NEWS.md` has no entry for the new version. |
| `release-preview.ps1 <plugin> [version]` | Read-only summary of what a release would look like. |
| `publish-plugin.ps1 -PluginName <plugin>` | Stages a registry entry from a pre-built `.ocplugin` and signs `manifest.json`. Does not tag, push, or create a GitHub Release. |
| `release-plugin.ps1 <plugin> <version>` | The orchestrator. Runs all of the above plus git ops and `gh release create`. |
| `build-all-plugins.ps1` | Builds every plugin at its current version (no release flow). Used for local install dogfooding, not publishing. |

---

## Per-plugin registry metadata

Each plugin has `packaging/registry.json` with fields that don't belong in the plugin manifest itself:

```json
{
  "categories": ["demo"],
  "min_app_version": "0.1.0"
}
```

Edit this when you want to change how the plugin is categorized in the registry.

---

## Notes

- `release_url` (GitHub release page) is always added automatically from the tag.
- Each plugin's registry page lives at `https://registry.openchoice.app/plugins/<plugin-id>/` (rebuilt on every registry push to `main`).
- The Open Choice app reads `pages_url` from the manifest to know where to link users when a newer version is available.
- `dist/*.ocplugin` files are never committed — they are `.gitignore`'d in each plugin.
- The registry signing key at `%USERPROFILE%\.open-choice\keys\oc-registry-2026.key` must never be committed.
