#!/usr/bin/env node
/**
 * add-plugin.js — Stage a new plugin release entry in plugins-pending/.
 *
 * Usage:
 *   node scripts/add-plugin.js <entry.json>
 *
 * Required fields in the entry JSON:
 *   plugin_id        — reverse-domain identifier  e.g. "com.example.my-plugin"
 *   display_name     — human-readable name
 *   description      — short description (one sentence)
 *   publisher        — publisher display name
 *   version          — semver e.g. "1.0.0"
 *   download_url     — https:// URL to the .ocplugin artifact
 *   artifact_sha256  — 64-char lowercase hex SHA-256 of the .ocplugin file
 *   signer_key_id    — key_id from trusted_keys.json that signed the artifact
 *   min_app_version  — minimum Open Choice version required
 *   released_at      — ISO 8601 timestamp
 *
 * Optional:
 *   categories       — array of strings (defaults to [])
 *
 * Output: plugins-pending/<plugin_id>-<version>.json
 * Next step: node scripts/sign-manifest.js --key-file <key> to rebuild manifest.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname }              from 'node:path';
import { fileURLToPath }              from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const REQUIRED = [
  'plugin_id', 'display_name', 'description', 'publisher',
  'version', 'download_url', 'artifact_sha256', 'signer_key_id',
  'min_app_version', 'released_at',
];

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/add-plugin.js <entry.json>');
  process.exit(1);
}

let entry;
try {
  entry = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`Failed to read/parse ${inputPath}: ${err.message}`);
  process.exit(1);
}

// Validate required fields.
const missing = REQUIRED.filter(f => !(f in entry));
if (missing.length > 0) {
  console.error(`Missing required fields: ${missing.join(', ')}`);
  process.exit(1);
}

// Enforce HTTPS downloads.
if (!entry.download_url.startsWith('https://')) {
  console.error(`download_url must start with https://`);
  process.exit(1);
}

// Enforce lowercase hex SHA-256.
if (!/^[0-9a-f]{64}$/.test(entry.artifact_sha256)) {
  console.error('artifact_sha256 must be a 64-char lowercase hex string');
  process.exit(1);
}

// Enforce semver shape.
if (!/^\d+\.\d+\.\d+$/.test(entry.version)) {
  console.error(`version must be semver (e.g. "1.2.3"), got: ${entry.version}`);
  process.exit(1);
}

if (!entry.categories) {
  entry.categories = [];
}

const slug    = `${entry.plugin_id.replace(/\./g, '-')}-${entry.version}`;
const outPath = join(ROOT, 'plugins-pending', `${slug}.json`);

// Canonical field order for readability.
const out = {
  plugin_id:       entry.plugin_id,
  display_name:    entry.display_name,
  description:     entry.description,
  publisher:       entry.publisher,
  categories:      entry.categories,
  version:         entry.version,
  download_url:    entry.download_url,
  artifact_sha256: entry.artifact_sha256,
  signer_key_id:   entry.signer_key_id,
  min_app_version: entry.min_app_version,
  released_at:     entry.released_at,
  ...(entry.release_notes && { release_notes: entry.release_notes }),
  ...(entry.release_url   && { release_url:   entry.release_url }),
};

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`==> Staged: plugins-pending/${slug}.json`);
console.log(`    Run 'node scripts/sign-manifest.js --key-file <key>' to rebuild manifest.json`);
