#!/usr/bin/env node
/**
 * sign-manifest.js — Rebuild and sign the Open Choice registry manifest.
 *
 * Reads every *.json file from plugins-pending/, groups them by plugin_id,
 * builds the manifest structure, signs the canonical content, and writes
 * manifest.json.
 *
 * Usage:
 *   node scripts/sign-manifest.js --key-file <path-to-key>
 *   OC_REGISTRY_KEY=<64-char-hex> node scripts/sign-manifest.js
 *
 * The private key is a 64-char lowercase hex string (32 raw bytes) — the
 * same format produced by `oc-sign keygen --key-id oc-registry-2026`.
 * In CI, inject it via the OC_REGISTRY_KEY Actions secret.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createPrivateKey, sign }                   from 'node:crypto';
import { join, dirname }                            from 'node:path';
import { fileURLToPath }                            from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

// ── Key loading ───────────────────────────────────────────────────────────────

function loadPrivateKey() {
  const flagIdx = process.argv.indexOf('--key-file');
  let hexKey;
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) {
    hexKey = readFileSync(process.argv[flagIdx + 1], 'utf8').trim();
  } else if (process.env.OC_REGISTRY_KEY) {
    hexKey = process.env.OC_REGISTRY_KEY.trim();
  } else {
    throw new Error('Provide --key-file <path> or set OC_REGISTRY_KEY env variable.');
  }

  if (hexKey.length !== 64 || !/^[0-9a-f]+$/i.test(hexKey)) {
    throw new Error(`Key must be exactly 64 lowercase hex chars (32 bytes), got ${hexKey.length}.`);
  }

  const rawKey = Buffer.from(hexKey, 'hex');

  // Wrap the raw 32-byte Ed25519 private key in a PKCS8 DER envelope so
  // Node.js crypto can import it. The 16-byte header is standard and constant
  // for Ed25519: SEQUENCE { version=0, AlgorithmIdentifier(OID 1.3.101.112),
  // OCTET STRING { OCTET STRING { <32 bytes> } } }
  const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
  const der = Buffer.concat([pkcs8Header, rawKey]);
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

// ── Pending entries ───────────────────────────────────────────────────────────

function readPendingEntries() {
  const pendingDir = join(ROOT, 'plugins-pending');
  const entries = [];
  for (const file of readdirSync(pendingDir).sort()) {
    if (!file.endsWith('.json')) continue;
    const raw   = readFileSync(join(pendingDir, file), 'utf8');
    const entry = JSON.parse(raw);
    entries.push({ _file: file, ...entry });
  }
  return entries;
}

// ── Manifest assembly ─────────────────────────────────────────────────────────

function buildPlugins(pendingEntries) {
  const byId = new Map();

  for (const entry of pendingEntries) {
    const {
      plugin_id, display_name, description, publisher, categories = [],
      version, download_url, artifact_sha256, signer_key_id,
      min_app_version, released_at, release_notes, release_url,
    } = entry;

    if (!byId.has(plugin_id)) {
      byId.set(plugin_id, {
        plugin_id,
        display_name,
        description,
        publisher,
        categories,
        latest_version: version,
        pages_url: `https://registry.openchoice.app/plugins/${plugin_id}/`,
        versions: [],
      });
    }

    const plugin = byId.get(plugin_id);
    if (semverGt(version, plugin.latest_version)) {
      plugin.latest_version = version;
    }

    plugin.versions.push({
      version,
      download_url,
      artifact_sha256,
      signer_key_id,
      min_app_version,
      released_at,
      ...(release_notes && { release_notes }),
      ...(release_url   && { release_url }),
    });
  }

  // Within each plugin: versions newest-first.
  for (const plugin of byId.values()) {
    plugin.versions.sort((a, b) => semverGt(b.version, a.version) ? 1 : -1);
  }

  // Plugins sorted by plugin_id for stable output.
  return [...byId.values()].sort((a, b) => a.plugin_id.localeCompare(b.plugin_id));
}

// Minimal semver comparison: returns true if a > b.
function semverGt(a, b) {
  const parse = v => v.split('.').map(n => parseInt(n, 10));
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

// ── Signing ───────────────────────────────────────────────────────────────────

function buildCanonical(schemaVersion, generatedAt, plugins) {
  // Canonical form: top-level keys sorted alphabetically, compact JSON.
  return JSON.stringify({ generated_at: generatedAt, plugins, schema_version: schemaVersion });
}

// ── Main ──────────────────────────────────────────────────────────────────────

const privateKey     = loadPrivateKey();
const pendingEntries = readPendingEntries();
const plugins        = buildPlugins(pendingEntries);
const schemaVersion  = '1';
const generatedAt    = new Date().toISOString();

const canonical  = buildCanonical(schemaVersion, generatedAt, plugins);
const sigBuffer  = sign(null, Buffer.from(canonical, 'utf8'), privateKey);
const signature  = sigBuffer.toString('base64');

const manifest = {
  schema_version: schemaVersion,
  generated_at:   generatedAt,
  signature,
  signer_key_id:  'oc-registry-2026',
  plugins,
};

const manifestPath = join(ROOT, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`==> manifest.json rebuilt: ${plugins.length} plugin(s)`);
console.log(`    generated_at: ${generatedAt}`);
console.log(`    signer_key_id: oc-registry-2026`);
