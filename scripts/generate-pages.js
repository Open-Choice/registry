#!/usr/bin/env node
/**
 * generate-pages.js — Generate static HTML pages from manifest.json.
 *
 * Outputs:
 *   site/index.html                          — all plugins listing
 *   site/plugins/<plugin-id>/index.html      — per-plugin version history
 *
 * Run after sign-manifest.js:
 *   node scripts/generate-pages.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname }                          from 'node:path';
import { fileURLToPath }                          from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const SITE      = join(ROOT, 'site');
const MANIFEST  = join(ROOT, 'manifest.json');

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const plugins  = manifest.plugins ?? [];

mkdirSync(SITE, { recursive: true });

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function html(strings, ...values) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Renders the subset of markdown used in NEWS.md:
// ## headings, - bullet lists, **bold**, paragraphs.
function renderMarkdown(md) {
  if (!md) return '';
  const lines  = md.split('\n');
  let out      = '';
  let inList   = false;

  const inlineEsc = str =>
    escHtml(str)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g,       '<em>$1</em>');

  for (const line of lines) {
    const t = line.trimEnd();
    if (t.startsWith('## ')) {
      if (inList) { out += '</ul>\n'; inList = false; }
      out += `<h3>${inlineEsc(t.slice(3))}</h3>\n`;
    } else if (t.startsWith('- ') || t.startsWith('* ')) {
      if (!inList) { out += '<ul>\n'; inList = true; }
      out += `<li>${inlineEsc(t.slice(2))}</li>\n`;
    } else if (t === '') {
      if (inList) { out += '</ul>\n'; inList = false; }
    } else {
      if (inList) { out += '</ul>\n'; inList = false; }
      out += `<p>${inlineEsc(t)}</p>\n`;
    }
  }
  if (inList) out += '</ul>\n';
  return out;
}

function pageShell(title, breadcrumb, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)} — Open Choice Registry</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #f8f8f8;
      margin: 0;
      padding: 0;
    }
    header {
      background: #1a1a2e;
      color: #fff;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      height: 52px;
    }
    header a { color: #a0c4ff; text-decoration: none; font-weight: 500; }
    header a:hover { text-decoration: underline; }
    header .sep { color: #555; }
    main {
      max-width: 860px;
      margin: 2.5rem auto;
      padding: 0 1.5rem;
    }
    h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
    h2 { font-size: 1.15rem; margin: 2rem 0 0.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem; }
    .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .plugin-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1rem;
    }
    .plugin-card h2 { margin-top: 0; border: none; padding: 0; font-size: 1.1rem; }
    .plugin-card .description { margin: 0.25rem 0 0.75rem; }
    .plugin-card .badges { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem; }
    .badge {
      background: #eef2ff;
      color: #3730a3;
      border-radius: 4px;
      padding: 0.1rem 0.5rem;
    }
    .version-block {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      margin-bottom: 1rem;
    }
    .version-block h3 {
      margin: 0 0 0.25rem;
      font-size: 1rem;
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
    }
    .version-block .date { color: #666; font-size: 0.85rem; font-weight: normal; }
    .version-block .notes { margin: 0.5rem 0 0.75rem; }
    .version-block .links { display: flex; gap: 1rem; font-size: 0.85rem; }
    .version-block .links a { color: #1d4ed8; text-decoration: none; }
    .version-block .links a:hover { text-decoration: underline; }
    .latest-tag {
      background: #dcfce7;
      color: #166534;
      border-radius: 4px;
      padding: 0.1rem 0.45rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    footer {
      text-align: center;
      color: #888;
      font-size: 0.8rem;
      margin: 3rem 0 1.5rem;
    }
    a { color: #1d4ed8; }
  </style>
</head>
<body>
  <header>
    ${breadcrumb}
  </header>
  <main>
    ${body}
  </main>
  <footer>Open Choice Registry &mdash; generated ${new Date().toUTCString()}</footer>
</body>
</html>`;
}

// ── Index page ────────────────────────────────────────────────────────────────

function renderIndex() {
  const cards = plugins.length === 0
    ? '<p>No plugins published yet.</p>'
    : plugins.map(p => {
        const cats = (p.categories ?? []).map(c =>
          `<span class="badge">${escHtml(c)}</span>`
        ).join('');
        return `
        <div class="plugin-card">
          <h2><a href="plugins/${escHtml(p.plugin_id)}/">${escHtml(p.display_name)}</a></h2>
          <p class="description">${escHtml(p.description)}</p>
          <div class="badges">
            <span class="badge">v${escHtml(p.latest_version)}</span>
            <span class="badge">${escHtml(p.publisher)}</span>
            ${cats}
          </div>
        </div>`;
      }).join('');

  const body = `
    <h1>Open Choice Plugin Registry</h1>
    <p class="meta">${plugins.length} plugin${plugins.length !== 1 ? 's' : ''} &mdash; last updated ${formatDate(manifest.generated_at)}</p>
    ${cards}`;

  const breadcrumb = `<a href=".">Open Choice Registry</a>`;

  writeFileSync(join(SITE, 'index.html'), pageShell('Open Choice Registry', breadcrumb, body), 'utf8');
  console.log('  site/index.html');
}

// ── Per-plugin pages ──────────────────────────────────────────────────────────

function renderPlugin(plugin) {
  const dir = join(SITE, 'plugins', plugin.plugin_id);
  mkdirSync(dir, { recursive: true });

  const versions = plugin.versions ?? [];

  const versionBlocks = versions.length === 0
    ? '<p>No versions published yet.</p>'
    : versions.map((v, i) => {
        const isLatest = i === 0;
        const notes    = v.release_notes
          ? `<div class="notes">${renderMarkdown(v.release_notes)}</div>`
          : '';
        const links = [];
        if (v.release_url)   links.push(`<a href="${escHtml(v.release_url)}">GitHub Release →</a>`);
        if (v.download_url)  links.push(`<a href="${escHtml(v.download_url)}">Download .ocplugin</a>`);

        return `
        <div class="version-block">
          <h3>
            v${escHtml(v.version)}
            ${isLatest ? '<span class="latest-tag">latest</span>' : ''}
            <span class="date">${formatDate(v.released_at)}</span>
          </h3>
          ${notes}
          ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
        </div>`;
      }).join('');

  const cats = (plugin.categories ?? []).map(c =>
    `<span class="badge">${escHtml(c)}</span>`
  ).join('');

  const body = `
    <h1>${escHtml(plugin.display_name)}</h1>
    <p class="meta">
      ${escHtml(plugin.publisher)}
      &nbsp;&mdash;&nbsp;
      Latest: v${escHtml(plugin.latest_version)}
      <br>
      <span style="font-size:0.85rem">${escHtml(plugin.plugin_id)}</span>
    </p>
    <p>${escHtml(plugin.description)}</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.5rem">${cats}</div>
    <h2>Version History</h2>
    ${versionBlocks}`;

  const breadcrumb = `
    <a href="../../">Open Choice Registry</a>
    <span class="sep">/</span>
    ${escHtml(plugin.display_name)}`;

  writeFileSync(join(dir, 'index.html'), pageShell(plugin.display_name, breadcrumb, body), 'utf8');
  console.log(`  site/plugins/${plugin.plugin_id}/index.html`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('==> Generating pages...');
renderIndex();
for (const plugin of plugins) {
  renderPlugin(plugin);
}
console.log(`==> Done. ${plugins.length} plugin page(s) written to site/`);
