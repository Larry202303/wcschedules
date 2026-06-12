#!/usr/bin/env node
'use strict';

/**
 * Generates per-host-city pages under public/matches-in-<slug>/index.html.
 * Targets "World Cup 2026 matches in <city>" long-tail queries. Kickoff times
 * are pre-rendered in that city's local time. Shares the nav + language
 * switcher (tz-page.js + i18n.js); each page is a single indexable English URL.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const matches = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'matches.json'), 'utf8'));
const teams = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'teams.json'), 'utf8'));
const teamByCode = Object.fromEntries(teams.map((t) => [t.code, t]));

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Stable, correct timezone abbreviations for the tournament window (Jun–Jul 2026).
const ABBR = {
  'America/New_York': 'EDT', 'America/Chicago': 'CDT', 'America/Los_Angeles': 'PDT',
  'America/Mexico_City': 'CST', 'America/Monterrey': 'CST', 'America/Toronto': 'EDT',
  'America/Vancouver': 'PDT',
};

// One short original blurb per city (avoids thin/duplicate content).
const BLURB = {
  Atlanta: 'Atlanta hosts World Cup 2026 matches at the Mercedes-Benz Stadium, a state-of-the-art retractable-roof venue in downtown Atlanta.',
  Boston: 'Boston-area matches are played at Gillette Stadium in Foxborough, home of the New England Patriots, about 30 miles southwest of the city.',
  Dallas: 'Dallas matches take place at AT&T Stadium in Arlington — one of the largest venues of the tournament and a candidate for late-stage knockout games.',
  Guadalajara: 'Guadalajara welcomes the World Cup back to Estadio Akron, Mexico’s modern stadium nestled in the Zapopan hills.',
  Houston: 'Houston hosts matches at NRG Stadium, a climate-controlled venue ideal for beating the Texas summer heat.',
  'Kansas City': 'Kansas City’s Arrowhead Stadium, famous for its electric atmosphere, brings World Cup football to the American Midwest.',
  'Los Angeles': 'Los Angeles matches are held at SoFi Stadium in Inglewood, the futuristic centerpiece of LA’s sports scene.',
  'Mexico City': 'Mexico City’s legendary Estadio Azteca hosts the opening match — the only stadium to feature in three different World Cups.',
  Miami: 'Miami brings the World Cup to Hard Rock Stadium in Miami Gardens, a sun-soaked venue with a tropical matchday vibe.',
  Monterrey: 'Monterrey hosts matches at Estadio BBVA, set against the dramatic backdrop of the Cerro de la Silla mountain.',
  'New York/New Jersey': 'The New York/New Jersey region hosts matches — including the Final — at MetLife Stadium in East Rutherford.',
  Philadelphia: 'Philadelphia welcomes the World Cup to Lincoln Financial Field, home of the Eagles, in the heart of the city’s sports complex.',
  'San Francisco': 'San Francisco Bay Area matches are played at Levi’s Stadium in Santa Clara, in the heart of Silicon Valley.',
  Seattle: 'Seattle hosts matches at Lumen Field, known for one of the loudest crowds in North American sport.',
  Toronto: 'Toronto brings World Cup football to Canada at BMO Field on the downtown waterfront.',
  Vancouver: 'Vancouver hosts matches at BC Place, a downtown retractable-roof stadium with a stunning mountain-and-sea setting.',
};

// ── time conversion (no external libs) ──────────────────────────────────────
function wallParts(instant, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const o = {};
  dtf.formatToParts(new Date(instant)).forEach((p) => { if (p.type !== 'literal') o[p.type] = +p.value; });
  return { Y: o.year, Mo: o.month, D: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute };
}
function toUtc(dateStr, timeStr, tz) {
  const [Y, Mo, D] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h, mi);
  const p = wallParts(guess, tz);
  return guess - (Date.UTC(p.Y, p.Mo - 1, p.D, p.h, p.mi) - guess);
}
function fmt(instant, tz, abbr) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });
  const p = {};
  dtf.formatToParts(new Date(instant)).forEach((x) => { p[x.type] = x.value; });
  return `${p.weekday}, ${p.month} ${p.day}, ${p.year}, ${p.hour}:${p.minute} ${abbr || p.timeZoneName}`;
}

// Group matches by city
const cities = {};
for (const m of matches) {
  (cities[m.city] = cities[m.city] || { stadium: m.stadium, tz: m.timezone, country: m.country, list: [] }).list.push(m);
}

function rows(cfg) {
  return cfg.list
    .slice()
    .sort((a, b) => toUtc(a.date_local, a.time_local, a.timezone) - toUtc(b.date_local, b.time_local, b.timezone))
    .map((m) => {
      const utc = toUtc(m.date_local, m.time_local, m.timezone);
      const home = teamByCode[m.home_code] || { name_en: m.home_code, flag: '' };
      const away = teamByCode[m.away_code] || { name_en: m.away_code, flag: '' };
      const matchSlug = `${m.home_code}-${m.away_code}-${m.date_local}`.toLowerCase();
      return `<tr><td>${fmt(utc, cfg.tz, ABBR[cfg.tz])}</td><td><span data-i18n="md_group">Group</span> ${esc(m.group)}</td>` +
        `<td>${home.flag} <a href="/teams/${slugify(home.name_en)}">${esc(home.name_en)}</a> vs ` +
        `${away.flag} <a href="/teams/${slugify(away.name_en)}">${esc(away.name_en)}</a></td>` +
        `<td><a href="/match/${matchSlug}" data-tzp="details">Details</a></td></tr>`;
    }).join('');
}

function page(city, cfg) {
  const slug = slugify(city);
  const title = `World Cup 2026 Matches in ${city}`;
  const desc = `Every 2026 FIFA World Cup match in ${city} (${cfg.stadium}), with kickoff times in local time, teams, groups and match links.`;
  const url = `https://www.wcschedules.com/matches-in-${slug}/`;
  const blurb = BLURB[city] || `${city} is a host city of the 2026 FIFA World Cup.`;
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
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How many World Cup 2026 matches are in ${esc(city)}?","acceptedAnswer":{"@type":"Answer","text":"${esc(city)} hosts ${cfg.list.length} matches of the 2026 FIFA World Cup at ${esc(cfg.stadium)}, all listed above in local time."}},{"@type":"Question","name":"Which stadium hosts the World Cup in ${esc(city)}?","acceptedAnswer":{"@type":"Answer","text":"Matches in ${esc(city)} are played at ${esc(cfg.stadium)}."}}]}</script>
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
h1{font-size:clamp(1.8rem,5vw,3.2rem);line-height:1.1;margin:0 0 12px;color:#fff}
h2{font-size:1.25rem;margin-top:30px;color:#fff}
.muted{color:#94a3b8}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;background:#1d4ed8;color:#fff;font-size:.78rem;font-weight:700;margin-bottom:10px}
table{width:100%;border-collapse:collapse;margin:14px 0 28px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);font-size:.95rem}
th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;vertical-align:top}
th{color:#cbd5e1;background:rgba(255,255,255,.06)}
footer{margin-top:40px;color:#94a3b8;font-size:.9rem;border-top:1px solid rgba(255,255,255,.1);padding-top:20px}
</style>
</head>
<body>
<nav class="nav">
  <a class="logo" href="/">⚽ WC2026</a>
  <a href="/#section-recent" data-i18n="nav_recent">Recent</a>
  <a href="/#section-groups" data-i18n="nav_groups">Group Stage</a>
  <a href="/#section-schedule" data-i18n="nav_schedule">Full Schedule</a>
  <a href="/watch/" data-tzp="watch">How to Watch</a>
  <span class="spacer"></span>
  <div id="app-header"></div>
</nav>
<div class="wrap">
  <section class="hero">
    <span class="pill">${esc(cfg.country)}</span>
    <h1>World Cup 2026 Matches in ${esc(city)}</h1>
    <p class="muted">All ${cfg.list.length} matches played in ${esc(city)} at ${esc(cfg.stadium)}, with kickoff times in local time. ${esc(blurb)}</p>
  </section>
  <table>
    <thead><tr><th>${esc(city)} local time</th><th>Stage</th><th>Match</th><th></th></tr></thead>
    <tbody>${rows(cfg)}</tbody>
  </table>
  <h2>About ${esc(cfg.stadium)}</h2>
  <p class="muted">${esc(blurb)} Want kickoff times in your own timezone instead? Use the <a href="/">interactive homepage schedule</a> to convert every match automatically.</p>
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
const slugs = [];
for (const [city, cfg] of Object.entries(cities)) {
  const slug = slugify(city);
  slugs.push(slug);
  const dir = path.join(PUBLIC, `matches-in-${slug}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(city, cfg), 'utf8');
  n++;
}
console.log(`Generated ${n} city pages: ${slugs.join(', ')}`);
