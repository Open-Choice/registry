<#
.SYNOPSIS
  Commits and pushes pending registry changes with an auto-generated commit message.

.DESCRIPTION
  Stages plugins-pending/ and manifest.json, inspects the new entries to build
  a commit message, then commits and pushes to origin/main.

  Run this after publish-to-registry.ps1 (or any other script that stages entries).

.EXAMPLE
  .\scripts\commit-registry.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path

Push-Location $RepoRoot

# ── Find staged/unstaged new files in plugins-pending/ ────────────────────────
$NewEntries = git diff --name-only HEAD -- plugins-pending/ 2>$null
# Also catch untracked files (first publish)
$Untracked  = git ls-files --others --exclude-standard plugins-pending/ 2>$null
$AllNew     = @($NewEntries) + @($Untracked) | Where-Object { $_ -match '\.json$' } | Sort-Object -Unique

if (-not $AllNew -and -not (git diff --name-only HEAD -- manifest.json 2>$null)) {
    Write-Host "Nothing to commit in plugins-pending/ or manifest.json."
    Pop-Location
    exit 0
}

# ── Build commit message from the entry files ─────────────────────────────────
$Parts = @(foreach ($File in $AllNew) {
    $FullPath = Join-Path $RepoRoot $File
    if (Test-Path $FullPath) {
        $Entry = Get-Content $FullPath -Raw | ConvertFrom-Json
        "$($Entry.plugin_id) v$($Entry.version)"
    }
})

$CommitMessage = if ($Parts.Count -eq 1) {
    "Add $($Parts[0])"
} elseif ($Parts.Count -gt 1) {
    "Add " + ($Parts -join ", ")
} else {
    "Update manifest"
}

# ── Stage, commit, push ───────────────────────────────────────────────────────
Write-Host "==> Commit message: $CommitMessage"

git add plugins-pending/ manifest.json
git commit -m $CommitMessage
git push origin main
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "git push failed."; exit 1 }

Pop-Location

Write-Host "==> Pushed to origin/main."
