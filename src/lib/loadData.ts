// Load manifest.json + endpoint help/examples at build time.
// All filesystem reads happen here so the page components stay declarative.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface PluginVersion {
  version: string;
  download_url: string;
  artifact_sha256: string;
  signer_key_id: string;
  min_app_version: string;
  released_at: string;
  release_url?: string;
  release_notes?: string;
}

export interface Plugin {
  plugin_id: string;
  display_name: string;
  description: string;
  publisher: string;
  categories: string[];
  latest_version: string;
  pages_url?: string;
  versions: PluginVersion[];
}

export interface Manifest {
  schema_version: string;
  generated_at: string;
  signature?: string;
  signer_key_id?: string;
  plugins: Plugin[];
}

export interface EndpointHelp {
  command: string;
  title?: string;
  summary?: string;
  usage?: string;
  arguments?: Array<{
    name: string;
    type?: string;
    required?: boolean;
    description?: string;
  }>;
  examples?: Array<{ title?: string; body: string }>;
  notes?: string[];
  fields?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface EndpointTemplate {
  template_id?: string;
  title?: string;
  summary?: string;
  oce_text?: string;
}

export function loadManifest(): Manifest {
  return JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
}

function safeReadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; }
  catch { return null; }
}

function safeListJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'));
}

/** List all endpoint commands for a plugin version, if their help JSON is on disk. */
export function listEndpoints(pluginId: string, version: string): string[] {
  const helpDir = join(ROOT, 'endpoints', pluginId, version, 'help');
  return safeListJson(helpDir)
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

export function loadEndpointHelp(
  pluginId: string, version: string, command: string
): EndpointHelp | null {
  const path = join(ROOT, 'endpoints', pluginId, version, 'help', `${command}.json`);
  return safeReadJson<EndpointHelp>(path);
}

export function loadEndpointTemplates(
  pluginId: string, version: string, command: string
): EndpointTemplate[] {
  const path = join(ROOT, 'endpoints', pluginId, version, 'examples', `${command}.json`);
  const raw = safeReadJson<EndpointTemplate[] | EndpointTemplate>(path);
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}
