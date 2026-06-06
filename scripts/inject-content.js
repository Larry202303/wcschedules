#!/usr/bin/env node
'use strict';

/**
 * Inject original match-preview text from data/previews.json into the static
 * HTML of each /match/<slug>/index.html.
 *
 * Why: match pages render the preview client-side from previews.json, so the
 * raw HTML the AdSense reviewer / non-JS crawlers see is a near-empty shell.
 * We inline the same original English copy into #md-preview so the page ships
 * substantial unique content on first byte. match.js still re-renders the same
 * text on load, so logged-in users see no change.
 *
 * Idempotent: re-running replaces a previously injected block (marked with
 * data-static-preview) instead of stacking duplicates.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const previewsFile = path.join(PUBLIC, 'data', 'previews.json');

const TITLES = {
  head_to_head: 'Head-to-head History',
  form_and_ranking: 'Form & Ranking',
  what_to_expect: 'What to Expect',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const previews = JSON.parse(fs.readFileSync(previewsFile, 'utf8')).previews || {};

function buildBlocks(rich) {
  let html = '<div class="md-preview-blocks" data-static-preview>';
  for (const key of ['head_to_head', 'form_and_ranking', 'what_to_expect']) {
    const text = rich[key];
    if (text) {
      html += `<div class="md-preview-block"><h4>${TITLES[key]}</h4><p>${escapeHtml(text)}</p></div>`;
    }
  }
  html += '</div>';
  return html;
}

const matchDir = path.join(PUBLIC, 'match');
const slugs = fs.readdirSync(matchDir).filter((d) =>
  fs.statSync(path.join(matchDir, d)).isDirectory()
);

let injected = 0;
let missing = 0;

slugs.forEach((slug) => {
  const file = path.join(matchDir, slug, 'index.html');
  if (!fs.existsSync(file)) return;

  const key = slug.toUpperCase(); // arg-alg-2026-06-16 -> ARG-ALG-2026-06-16
  const rich = previews[key];
  if (!rich || !(rich.head_to_head || rich.form_and_ranking || rich.what_to_expect)) {
    console.warn(`  no preview for ${slug} (key ${key})`);
    missing++;
    return;
  }

  let html = fs.readFileSync(file, 'utf8');
  const blocks = buildBlocks(rich);

  // Replace an already-injected block, or fill the empty #md-preview div.
  const filled = /<div id="md-preview" class="md-preview">[\s\S]*?<\/div>\s*<\/section>/;
  const empty = /<div id="md-preview" class="md-preview"><\/div>/;

  if (empty.test(html)) {
    html = html.replace(empty, `<div id="md-preview" class="md-preview">${blocks}</div>`);
  } else if (/data-static-preview/.test(html)) {
    html = html.replace(
      /<div id="md-preview" class="md-preview">[\s\S]*?<\/div>(\s*<\/section>)/,
      `<div id="md-preview" class="md-preview">${blocks}</div>$1`
    );
  } else {
    console.warn(`  could not find #md-preview target in ${slug}`);
    missing++;
    return;
  }

  fs.writeFileSync(file, html, 'utf8');
  injected++;
});

console.log(`\nInjected previews into ${injected} match pages. Missing/skipped: ${missing}.`);
