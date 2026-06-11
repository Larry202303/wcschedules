#!/usr/bin/env node
'use strict';

/**
 * Generates the per-country-timezone schedule pages under public/schedule/<slug>/.
 *
 * Each page is a single indexable English URL targeting "World Cup 2026 schedule
 * in <country> time" long-tail queries, with kickoff times PRE-RENDERED into the
 * static HTML (so crawlers see the answer without running JS).
 *
 * It also ships the shared top navigation + a client-side language switcher
 * (tz-page.js + i18n.js). Switching language only re-labels the chrome and
 * persists the choice — it does NOT create new indexable URLs, keeping the
 * machine-translation footprint at zero (AdSense-safe).
 *
 * Existing pages keep their exact titles/slugs so rankings are preserved; the
 * 5 new ones (uk/australia/brazil/mexico/gulf) extend long-tail coverage.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const matches = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'matches.json'), 'utf8'));
const teams = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'teams.json'), 'utf8'));
const teamByCode = Object.fromEntries(teams.map((t) => [t.code, t]));

// slug: matches the existing /teams/<slug> directories (verified: 0 mismatches)
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// label = how it appears in the title ("World Cup 2026 Schedule in <label>")
// `abbr` forces a clean timezone label where this environment's ICU data falls
// back to "GMT+X". Stable for the whole tournament window (Jun 11 – Jul 19, 2026).
const PAGES = [
  // existing — titles preserved exactly
  { slug: 'china-time', tz: 'Asia/Shanghai', label: 'China Time', pill: 'China Time', abbr: 'GMT+8' },
  { slug: 'india-time', tz: 'Asia/Kolkata', label: 'India Time', pill: 'India Time', abbr: 'IST' },
  { slug: 'germany-time', tz: 'Europe/Berlin', label: 'Germany Time', pill: 'Germany Time', abbr: 'CEST' },
  { slug: 'france-time', tz: 'Europe/Paris', label: 'France Time', pill: 'France Time', abbr: 'CEST' },
  { slug: 'us-eastern-time', tz: 'America/New_York', label: 'US Eastern Time', pill: 'Eastern Time', abbr: 'EDT' },
  { slug: 'us-pacific-time', tz: 'America/Los_Angeles', label: 'US Pacific Time', pill: 'Pacific Time', abbr: 'PDT' },
  { slug: 'italy-time', tz: 'Europe/Rome', label: 'Italy Time', pill: 'Italy Time', abbr: 'CEST' },
  // new — high-traffic football/English markets
  { slug: 'uk-time', tz: 'Europe/London', label: 'UK Time', pill: 'UK Time', abbr: 'BST' },
  { slug: 'australia-time', tz: 'Australia/Sydney', label: 'Australia Time', pill: 'Australia Time', abbr: 'AEST' },
  { slug: 'brazil-time', tz: 'America/Sao_Paulo', label: 'Brazil Time', pill: 'Brazil Time', abbr: 'BRT' },
  { slug: 'mexico-time', tz: 'America/Mexico_City', label: 'Mexico Time', pill: 'Mexico Time', abbr: 'CST' },
  { slug: 'gulf-time', tz: 'Asia/Dubai', label: 'Gulf Time', pill: 'Gulf Time', abbr: 'GST' },
];

// ── time conversion (no external libs) ──────────────────────────────────────
function wallParts(instant, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const o = {};
  dtf.formatToParts(new Date(instant)).forEach((p) => { if (p.type !== 'literal') o[p.type] = +p.value; });
  return { Y: o.year, Mo: o.month, D: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute };
}

// Convert a wall-clock time in source tz to a UTC instant (ms).
function toUtc(dateStr, timeStr, tz) {
  const [Y, Mo, D] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h, mi);
  const p = wallParts(guess, tz);
  const wallAsUtc = Date.UTC(p.Y, p.Mo - 1, p.D, p.h, p.mi);
  return guess - (wallAsUtc - guess); // subtract tz offset
}

// "Thu, Jun 11, 2026, 15:00 EDT"
function fmt(instant, tz, abbr) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short',
  });
  const p = {};
  dtf.formatToParts(new Date(instant)).forEach((x) => { p[x.type] = x.value; });
  return `${p.weekday}, ${p.month} ${p.day}, ${p.year}, ${p.hour}:${p.minute} ${abbr || p.timeZoneName}`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildRows(cfg) {
  return matches.map((m) => {
    const utc = toUtc(m.date_local, m.time_local, m.timezone);
    const home = teamByCode[m.home_code] || { name_en: m.home_code, flag: '' };
    const away = teamByCode[m.away_code] || { name_en: m.away_code, flag: '' };
    const matchSlug = `${m.home_code}-${m.away_code}-${m.date_local}`.toLowerCase();
    return `<tr><td>${fmt(utc, cfg.tz, cfg.abbr)}</td><td><span data-i18n="md_group">Group</span> ${esc(m.group)}</td>` +
      `<td>${home.flag} <a href="/teams/${slugify(home.name_en)}">${esc(home.name_en)}</a> vs ` +
      `${away.flag} <a href="/teams/${slugify(away.name_en)}">${esc(away.name_en)}</a></td>` +
      `<td><a href="/match/${matchSlug}" data-tzp="details">Details</a></td></tr>`;
  }).join('');
}

function page(cfg) {
  const title = `World Cup 2026 Schedule in ${cfg.label}`;
  const desc = `Complete World Cup 2026 group-stage schedule converted to ${cfg.label}, with kickoff times, teams, groups, venues and match links. Updated automatically for fans in your country.`;
  const url = `https://www.wcschedules.com/schedule/${cfg.slug}/`;
  const rows = buildRows(cfg);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://www.wcschedules.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://www.wcschedules.com/og-image.png">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚽</text></svg>">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What time does the 2026 World Cup start in ${esc(cfg.label)}?","acceptedAnswer":{"@type":"Answer","text":"This page lists every 2026 World Cup group-stage match with kickoff times already converted to ${esc(cfg.label)}, starting with the opening match on June 11, 2026."}},{"@type":"Question","name":"Is this the full 2026 World Cup schedule?","acceptedAnswer":{"@type":"Answer","text":"Yes, it covers all 72 group-stage matches across the USA, Canada and Mexico, each linked to a detailed match page with lineups and a preview."}}]}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-JFNFTFSZCF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-JFNFTFSZCF');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8973794917285635" crossorigin="anonymous"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b1020;color:#e5e7eb;line-height:1.65}
a{color:#93c5fd;text-decoration:none}a:hover{text-decoration:underline}
.nav{position:sticky;top:0;z-index:20;background:#11162a;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:18px;padding:12px 20px;flex-wrap:wrap}
.nav .logo{font-weight:800;color:#fff;font-size:1.05rem}
.nav a{color:#cbd5e1;font-size:.92rem}.nav a:hover{color:#fff}
.nav .spacer{flex:1}
.nav #app-header{display:flex;gap:8px;align-items:center}
.lang-select{background:#1d2440;color:#e5e7eb;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px;font-size:.88rem}
.wrap{max-width:1040px;margin:0 auto;padding:28px 20px 60px}
.hero{padding:24px 0;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:24px}
h1{font-size:clamp(1.8rem,5vw,3.4rem);line-height:1.08;margin:0 0 12px;color:#fff}
h2{font-size:1.25rem;margin-top:30px;color:#fff}
.muted{color:#94a3b8}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;background:#1d4ed8;color:#fff;font-size:.78rem;font-weight:700;margin-bottom:10px}
table{width:100%;border-collapse:collapse;margin:14px 0 28px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);font-size:.95rem}
th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;vertical-align:top}
th{color:#cbd5e1;background:rgba(255,255,255,.06)}
.watch{display:inline-block;margin:6px 0 18px;padding:10px 18px;background:#1b2a4a;border:1px solid #2e4170;border-radius:10px;color:#cfe0ff;font-weight:600}
footer{margin-top:40px;color:#94a3b8;font-size:.9rem;border-top:1px solid rgba(255,255,255,.1);padding-top:20px}
</style>
</head>
<body>
<nav class="nav">
  <a class="logo" href="/">⚽ WC2026</a>
  <a href="/#section-recent" data-i18n="nav_recent">Recent</a>
  <a href="/#section-groups" data-i18n="nav_groups">Group Stage</a>
  <a href="/#scorers-section" data-i18n="nav_scorers">Top Scorers</a>
  <a href="/#section-schedule" data-i18n="nav_schedule">Full Schedule</a>
  <a href="/watch/" data-tzp="watch">How to Watch</a>
  <span class="spacer"></span>
  <div id="app-header"></div>
</nav>
<div class="wrap">
  <section class="hero">
    <span class="pill">${esc(cfg.label)}</span>
    <h1 data-tzp="h1" data-tz="${esc(cfg.label)}">${esc(title)}</h1>
    <p class="muted" data-tzp="intro" data-tz="${esc(cfg.label)}">All kickoff times below are shown in ${esc(cfg.label)}. Use the language menu above to change the interface language.</p>
    <a class="watch" href="/watch/" data-tzp="watch">How to Watch</a>
  </section>
  <table>
    <thead><tr><th>${esc(cfg.label)}</th><th data-tzp="stage">Stage</th><th data-tzp="match">Match</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2 data-tzp="why_title">Why this page exists</h2>
  <p class="muted" data-tzp="why_body" data-tz="${esc(cfg.label)}">This page shows the full 2026 World Cup group-stage schedule, pre-converted to ${esc(cfg.label)}. Every match links to a detailed preview with lineups and head-to-head history.</p>
  <footer>
    <p data-i18n="footer_text">© 2026 wcschedules.com · Not affiliated with FIFA</p>
  </footer>
</div>
<script src="/js/i18n.js?v=20260601a"></script>
<script src="/js/tz-page.js?v=20260611a"></script>
</body>
</html>`;
}

let n = 0;
for (const cfg of PAGES) {
  const dir = path.join(PUBLIC, 'schedule', cfg.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(cfg), 'utf8');
  n++;
}
console.log(`Generated ${n} timezone schedule pages.`);
