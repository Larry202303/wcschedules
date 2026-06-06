#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const BASE_URL = 'https://www.wcschedules.com';

const OG_IMAGE_META = `
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="World Cup 2026 Schedule">`;

let totalPatched = 0;

// ─── helpers ────────────────────────────────────────────────────────────────

function readHtml(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeHtml(file, html) {
  fs.writeFileSync(file, html, 'utf8');
  totalPatched++;
}

// Extract content of first matching tag attribute
function extractAttr(html, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

// Extract inner text of first matching element (supports id or class)
function extractInner(html, tag, idOrClass) {
  const re = new RegExp(`<${tag}[^>]*(?:id|class)="${idOrClass}"[^>]*>([^<]*)`, 'i');
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

function escape(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonEscape(str) {
  return str.replace(/"/g, '\\"');
}

// ─── MATCH PAGES ────────────────────────────────────────────────────────────

function fixMatchPage(file) {
  let html = readHtml(file);
  const slug = path.basename(path.dirname(file));
  const canonicalUrl = `${BASE_URL}/match/${slug}/`;

  // 1. Fix canonical URL — add trailing slash
  html = html.replace(
    /(<link rel="canonical"[^>]*href=")https:\/\/www\.wcschedules\.com\/match\/[^"]*(")/i,
    `$1${canonicalUrl}$2`
  );

  // 2. Fix og:description — replace generic with specific meta description
  const metaDesc = extractAttr(html, 'meta', 'content').trim() ||
    (() => { const m = html.match(/name="description"[^>]*content="([^"]*)"/i); return m ? m[1] : ''; })();
  // More reliable: grab the page-desc content
  const pageDescMatch = html.match(/id="page-desc"[^>]*content="([^"]*)"/i) ||
    html.match(/name="description"[^>]*content="([^"]*)"/i);
  const specificDesc = pageDescMatch ? pageDescMatch[1] : '';

  if (specificDesc) {
    html = html.replace(
      /<meta property="og:description"[^>]*content="Match details, lineups, live odds\."[^>]*>/i,
      `<meta property="og:description" id="og-desc" content="${escape(specificDesc)}">`
    );
  }

  // 3. Add twitter:description if missing
  if (!html.includes('twitter:description')) {
    const desc = specificDesc || '';
    html = html.replace(
      /(<meta name="twitter:image"[^>]*>)/i,
      `$1\n  <meta name="twitter:description" content="${escape(desc)}">`
    );
  }

  // 4. Add og:image dimensions/alt if missing
  if (!html.includes('og:image:width')) {
    html = html.replace(
      /(<meta property="og:image"[^>]*>)/i,
      `$1${OG_IMAGE_META}`
    );
  }

  // 5. Fix JSON-LD url fields — add trailing slash
  html = html.replace(
    new RegExp(`"url":"${BASE_URL}/match/${slug}"`, 'g'),
    `"url":"${canonicalUrl}"`
  );

  // 6. Add H1 (sr-only) before md-loading div
  if (!html.includes('<h1')) {
    const title = extractTitle(html);
    html = html.replace(
      /(<div id="md-loading")/,
      `<h1 class="sr-only">${escape(title)}</h1>\n\n    $1`
    );
  }

  // 7. Add BreadcrumbList JSON-LD if missing
  if (!html.includes('BreadcrumbList')) {
    const title = extractTitle(html);
    // Extract team names from title: "Home vs Away — ..."
    const teamsMatch = title.match(/^(.+?) vs (.+?) —/);
    const matchName = teamsMatch ? `${teamsMatch[1]} vs ${teamsMatch[2]}` : title;
    const breadcrumb = `
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${BASE_URL}/"},{"@type":"ListItem","position":2,"name":"${jsonEscape(matchName)}","item":"${canonicalUrl}"}]}</script>`;
    html = html.replace('</head>', `${breadcrumb}\n</head>`);
  }

  writeHtml(file, html);
}

// ─── TEAM PAGES ─────────────────────────────────────────────────────────────

function fixTeamPage(file) {
  let html = readHtml(file);
  const slug = path.basename(path.dirname(file));
  const canonicalUrl = `${BASE_URL}/teams/${slug}/`;

  // 1. Fix canonical URL — add trailing slash
  html = html.replace(
    /(<link rel="canonical"[^>]*href=")https:\/\/www\.wcschedules\.com\/teams\/[^"]*(")/i,
    `$1${canonicalUrl}$2`
  );

  // 2. Fix og:url — add trailing slash
  html = html.replace(
    /(<meta property="og:url"[^>]*content=")https:\/\/www\.wcschedules\.com\/teams\/[^"]*(")/i,
    `$1${canonicalUrl}$2`
  );

  // 3. Fix JSON-LD url — add trailing slash
  html = html.replace(
    new RegExp(`"url":"${BASE_URL}/teams/${slug}"`, 'g'),
    `"url":"${canonicalUrl}"`
  );

  // 4. Add twitter:description if missing
  if (!html.includes('twitter:description')) {
    const ogDescMatch = html.match(/property="og:description"[^>]*content="([^"]*)"/i);
    const desc = ogDescMatch ? ogDescMatch[1] : '';
    html = html.replace(
      /(<meta name="twitter:image"[^>]*>)/i,
      `$1\n  <meta name="twitter:description" content="${escape(desc)}">`
    );
  }

  // 5. Add og:image dimensions/alt if missing
  if (!html.includes('og:image:width')) {
    html = html.replace(
      /(<meta property="og:image"[^>]*>)/i,
      `$1${OG_IMAGE_META}`
    );
  }

  // 6. Change <div class="team-name"> to <h1 class="team-name"> (first occurrence only)
  if (!html.includes('<h1 class="team-name"') && !html.includes("<h1 class='team-name'")) {
    html = html.replace(
      /<div class="team-name" id="team-name-el">/,
      '<h1 class="team-name" id="team-name-el">'
    );
    html = html.replace(
      /(<\/div>)([\s\S]*?<div class="team-meta")/,
      (match, closeDiv, rest) => {
        // Only replace the first closing div after team-name h1
        return match.replace(/<\/div>/, '</h1>');
      }
    );
    // Simpler approach: just replace the first occurrence after the opening tag
    html = html.replace(
      /(<h1 class="team-name" id="team-name-el">[^<]*)<\/div>/,
      '$1</h1>'
    );
  }

  // 7. Add BreadcrumbList JSON-LD if missing
  if (!html.includes('BreadcrumbList')) {
    const teamNameMatch = html.match(/<h1 class="team-name"[^>]*>([^<]*)<\/h1>/i) ||
      html.match(/<div class="team-name"[^>]*>([^<]*)<\/div>/i);
    const teamName = teamNameMatch ? teamNameMatch[1].trim() : slug;
    const breadcrumb = `  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${BASE_URL}/"},{"@type":"ListItem","position":2,"name":"${jsonEscape(teamName)} World Cup 2026","item":"${canonicalUrl}"}]}</script>`;
    html = html.replace('</head>', `${breadcrumb}\n</head>`);
  }

  // 8. Add H1 if still missing (fallback)
  if (!html.includes('<h1')) {
    const title = extractTitle(html);
    html = html.replace(
      /(<div class="team-hero">)/,
      `$1\n      <h1 class="sr-only">${escape(title)}</h1>`
    );
  }

  writeHtml(file, html);
}

// ─── GROUP PAGES ─────────────────────────────────────────────────────────────

function fixGroupPage(file) {
  let html = readHtml(file);
  const slug = path.basename(path.dirname(file));
  const canonicalUrl = `${BASE_URL}/groups/${slug}/`;
  const title = extractTitle(html);

  // 1. Fix canonical URL — add trailing slash
  html = html.replace(
    /(<link rel="canonical"[^>]*id="page-canonical"[^>]*href=")https:\/\/www\.wcschedules\.com\/groups\/[^"]*(")/i,
    `$1${canonicalUrl}$2`
  );

  // 2. Fix og:url — add trailing slash
  html = html.replace(
    /(<meta property="og:url"[^>]*content=")https:\/\/www\.wcschedules\.com\/groups\/[^"]*(")/i,
    `$1${canonicalUrl}$2`
  );

  // 3. Add twitter:description if missing
  if (!html.includes('twitter:description')) {
    const ogDescMatch = html.match(/id="og-desc"[^>]*content="([^"]*)"/i) ||
      html.match(/property="og:description"[^>]*content="([^"]*)"/i);
    const desc = ogDescMatch ? ogDescMatch[1] : '';
    html = html.replace(
      /(<meta name="twitter:image"[^>]*>)/i,
      `$1\n  <meta name="twitter:description" content="${escape(desc)}">`
    );
  }

  // 4. Add og:image dimensions/alt if missing
  if (!html.includes('og:image:width')) {
    html = html.replace(
      /(<meta property="og:image"[^>]*>)/i,
      `$1${OG_IMAGE_META}`
    );
  }

  // 5. Add H1 (sr-only) before gp-loading div
  if (!html.includes('<h1')) {
    html = html.replace(
      /(<div id="gp-loading")/,
      `<h1 class="sr-only">${escape(title)}</h1>\n\n    $1`
    );
  }

  // 6. Extract teams from title for ItemList: "Group A: Team1, Team2, Team3, Team4 — ..."
  let itemListJson = '';
  const groupLetter = slug.toUpperCase();
  const teamsMatch = title.match(/Group [A-L]: (.+?) —/i);
  if (teamsMatch) {
    const teamNames = teamsMatch[1].split(', ').map(t => t.trim());
    const items = teamNames.map((t, i) => {
      const teamSlug = t.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-');
      return `{"@type":"ListItem","position":${i + 1},"name":"${jsonEscape(t)}","url":"${BASE_URL}/teams/${teamSlug}/"}`;
    }).join(',');
    itemListJson = `  <script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","name":"World Cup 2026 Group ${groupLetter}","itemListElement":[${items}]}</script>`;
  }

  // 7. Add BreadcrumbList + ItemList JSON-LD if missing
  if (!html.includes('BreadcrumbList')) {
    const breadcrumb = `  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${BASE_URL}/"},{"@type":"ListItem","position":2,"name":"World Cup 2026 Group ${groupLetter}","item":"${canonicalUrl}"}]}</script>`;
    const schemas = itemListJson ? `\n${itemListJson}\n${breadcrumb}` : `\n${breadcrumb}`;
    html = html.replace('</head>', `${schemas}\n</head>`);
  }

  writeHtml(file, html);
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

// Process match pages
const matchDir = path.join(PUBLIC, 'match');
const matchSlugs = fs.readdirSync(matchDir).filter(d =>
  fs.statSync(path.join(matchDir, d)).isDirectory()
);
console.log(`Processing ${matchSlugs.length} match pages...`);
matchSlugs.forEach(slug => {
  const file = path.join(matchDir, slug, 'index.html');
  if (fs.existsSync(file)) {
    try { fixMatchPage(file); }
    catch (e) { console.error(`  ERROR match/${slug}: ${e.message}`); }
  }
});

// Process team pages
const teamsDir = path.join(PUBLIC, 'teams');
const teamSlugs = fs.readdirSync(teamsDir).filter(d =>
  fs.statSync(path.join(teamsDir, d)).isDirectory()
);
console.log(`Processing ${teamSlugs.length} team pages...`);
teamSlugs.forEach(slug => {
  const file = path.join(teamsDir, slug, 'index.html');
  if (fs.existsSync(file)) {
    try { fixTeamPage(file); }
    catch (e) { console.error(`  ERROR teams/${slug}: ${e.message}`); }
  }
});

// Process group pages
const groupsDir = path.join(PUBLIC, 'groups');
const groupSlugs = fs.readdirSync(groupsDir).filter(d =>
  fs.statSync(path.join(groupsDir, d)).isDirectory()
);
console.log(`Processing ${groupSlugs.length} group pages...`);
groupSlugs.forEach(slug => {
  const file = path.join(groupsDir, slug, 'index.html');
  if (fs.existsSync(file)) {
    try { fixGroupPage(file); }
    catch (e) { console.error(`  ERROR groups/${slug}: ${e.message}`); }
  }
});

console.log(`\nDone. Total files patched: ${totalPatched}`);
