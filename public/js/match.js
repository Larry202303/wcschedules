/* ============================================
   Match Detail Page
   URL: /match/{home}-{away}-{YYYY-MM-DD}?lang=xx
   Or local preview: /match.html?id={slug}&lang=xx
   ============================================ */

const POLYMARKET_REF = "wcschedules";
const STORAGE_TEAM = "wc_my_team";

let DATA = {
  teams: [],
  matches: [],
  i18n: { teams: {}, cities: {}, stadiums: {} },
  coaches: {},
  squads: {},
  polymarketLinks: [],
  previews: {},
  coachesI18n: {},
  clubsI18n: {},
};
let STATE = {
  lang: "en",
  myTeam: null,
  match: null,
  pmLink: null,
  tz: "auto",
};

// FIFA → Polymarket code map (same as app.js)
const PM_CODE_MAP = {
  KOR: "kor", JPN: "jpn", AUS: "aus", IRN: "irn",
  USA: "usa", MEX: "mex", CAN: "can", CRC: "crc", PAN: "pan",
  NED: "nld", GER: "ger", SUI: "che", CRO: "hrv", POR: "prt",
  SRB: "srb", ESP: "esp", FRA: "fra", BEL: "bel", ENG: "eng",
  SCO: "sco", NOR: "nor", DEN: "den", SWE: "swe", AUT: "aut",
  ARG: "arg", BRA: "bra", URU: "ury", COL: "col", ECU: "ecu",
  PAR: "par", VEN: "ven", BOL: "bol",
  MAR: "mar", TUN: "tun", EGY: "egy", SEN: "sen", GHA: "gha",
  NGA: "nga", CIV: "civ", RSA: "rsa", ALG: "alg", CPV: "cvi",
  KSA: "ksa", QAT: "qat", JOR: "jor", IRQ: "irq",
  NZL: "nzl", HAI: "hai", JAM: "jam", CUW: "cuw", SUR: "sur",
  UZB: "uzb", COD: "cdr", UKR: "ukr", CZE: "cze", BIH: "bih",
  TUR: "tur", ITA: "ita",
};

const t = (key) => (window.t ? window.t(key, STATE.lang) : key);

/* ============================================
   PARSE SLUG FROM URL
   /match/arg-fra-2026-06-22 → { home: "ARG", away: "FRA", date: "2026-06-22" }
   ============================================ */
function parseSlug() {
  // Try path first (production): /match/xxx
  let slug = null;
  const m = window.location.pathname.match(/^\/match\/([^/]+)/);
  if (m) slug = m[1];

  // Fallback for local preview: ?id=xxx
  if (!slug) {
    const params = new URLSearchParams(window.location.search);
    slug = params.get("id");
  }
  if (!slug) return null;

  // pattern: xxx-yyy-YYYY-MM-DD
  const parts = slug.split("-");
  if (parts.length < 5) return null;
  const home = parts[0].toUpperCase();
  const away = parts[1].toUpperCase();
  const date = parts.slice(2).join("-"); // 2026-06-22
  return { home, away, date };
}

/* ============================================
   BOOT
   ============================================ */
async function boot() {
  STATE.lang = window.detectLang();
  STATE.myTeam = localStorage.getItem(STORAGE_TEAM);
  STATE.tz = window.getStoredTz ? window.getStoredTz() : "auto";
  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = window.RTL_LANGS.includes(STATE.lang) ? "rtl" : "ltr";

  const target = parseSlug();
  if (!target) return showError();

  try {
    const [teams, matches, i18nData, coaches, squads, pmLinks, previews, coachesI18n, clubsI18n, previewsI18n] = await Promise.all([
      fetch("/data/teams.json").then((r) => r.json()),
      fetch("/data/matches.json").then((r) => r.json()),
      fetch("/data/i18n_data.json").then((r) => r.json()).catch(() => ({ teams: {}, cities: {}, stadiums: {} })),
      fetch("/data/coaches.json").then((r) => r.json()).catch(() => ({})),
      fetch("/data/squads.json").then((r) => r.json()).catch(() => ({})),
      fetch("/data/polymarket_links.json").then((r) => r.json()).catch(() => ({ matches: [] })),
      fetch("/data/previews.json").then((r) => r.json()).catch(() => ({ previews: {} })),
      fetch("/data/i18n_coaches.json").then((r) => r.json()).catch(() => ({ coaches: {} })),
      fetch("/data/i18n_clubs.json").then((r) => r.json()).catch(() => ({ clubs: {} })),
      fetch("/data/i18n_previews.json").then((r) => r.json()).catch(() => ({ previews: {} })),
    ]);
    DATA.teams = teams;
    DATA.matches = matches;
    DATA.i18n = i18nData;
    DATA.coaches = coaches.coaches || coaches;
    DATA.squads = squads.squads || squads;
    DATA.polymarketLinks = pmLinks.matches || [];
    DATA.previews = previews.previews || previews || {};
    DATA.coachesI18n = (coachesI18n.coaches) || coachesI18n || {};
    DATA.clubsI18n = (clubsI18n.clubs) || clubsI18n || {};
    DATA.previewsI18n = (previewsI18n && (previewsI18n.previews || previewsI18n)) || {};
  } catch (e) {
    console.error("Data load fail:", e);
    return showError();
  }

  STATE.match = DATA.matches.find(
    (m) => m.home_code === target.home && m.away_code === target.away && m.date_local === target.date
  );

  if (!STATE.match) return showError();

  STATE.pmLink = findPolymarketLink(STATE.match);

  applyTranslationsWrapper();
  renderHeader();
  if (window.initTopNav) initTopNav();
  renderHero();
  renderPreview();
  renderCoaches();
  renderSquads();
  renderSeoMeta();

  document.getElementById("md-loading").style.display = "none";
  document.getElementById("md-content").style.display = "block";

  // Fetch live odds (non-blocking)
  loadOdds();
}

function applyTranslationsWrapper() {
  if (window.applyTranslations) window.applyTranslations(STATE.lang);
}

function showError() {
  document.getElementById("md-loading").style.display = "none";
  document.getElementById("md-error").style.display = "block";
}

document.addEventListener("DOMContentLoaded", boot);

/* ============================================
   HELPERS (mirror app.js)
   ============================================ */
function teamByCode(code) {
  return DATA.teams.find((tm) => tm.code === code) || { code, name_en: code, flag: "⚽", group: "?" };
}
function teamName(code) {
  const entry = DATA.i18n.teams[code];
  if (entry && entry[STATE.lang]) return entry[STATE.lang];
  if (entry && entry.en) return entry.en;
  return teamByCode(code).name_en;
}
function teamSlug(code) {
  const t = teamByCode(code);
  const name = (t && t.name_en) || code;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function cityName(en) {
  const entry = DATA.i18n.cities[en];
  return entry && entry[STATE.lang] ? entry[STATE.lang] : en;
}
function stadiumName(en) {
  const entry = DATA.i18n.stadiums[en];
  return entry && entry[STATE.lang] ? entry[STATE.lang] : en;
}
function localeForIntl(lang) {
  return { "zh-CN": "zh-CN", "zh-TW": "zh-TW", en: "en-US", es: "es-ES", pt: "pt-BR", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", ar: "ar-SA", id: "id-ID" }[lang] || "en-US";
}

function matchTimeUTC(m) {
  const [y, mo, d] = m.date_local.split("-").map(Number);
  const [hh, mm] = m.time_local.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: m.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = dtf.formatToParts(new Date(naive));
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  const tzY = get("year"), tzM = get("month"), tzD = get("day");
  const tzH = get("hour") === 24 ? 0 : get("hour");
  const tzAsUTC = Date.UTC(tzY, tzM - 1, tzD, tzH, get("minute"), get("second"));
  return new Date(naive - (tzAsUTC - naive));
}

function findPolymarketLink(match) {
  const pmHome = PM_CODE_MAP[match.home_code] || match.home_code.toLowerCase();
  const pmAway = PM_CODE_MAP[match.away_code] || match.away_code.toLowerCase();
  const [y, mo, d] = match.date_local.split("-").map(Number);
  for (const off of [0, -1, 1]) {
    const dt = new Date(Date.UTC(y, mo - 1, d + off)).toISOString().slice(0, 10);
    const hit = DATA.polymarketLinks.find(
      (p) => p.home.toLowerCase() === pmHome && p.away.toLowerCase() === pmAway && p.date === dt
    );
    if (hit) return hit;
  }
  return null;
}

/* ============================================
   HEADER
   ============================================ */
function renderHeader() {
  const header = document.getElementById("app-header");
  if (!header) return;
  const myTeam = STATE.myTeam ? teamByCode(STATE.myTeam) : null;
  const langOpts = window.LANG_LIST.map(
    (l) => `<option value="${l.code}" ${l.code === STATE.lang ? "selected" : ""}>${l.flag} ${l.name}</option>`
  ).join("");
  const tzOpts = (window.TIMEZONE_LIST || []).map((tz) => {
    const isAuto = tz.id === "auto";
    const label = isAuto ? `${tz.label} (${window.getSystemTz ? window.getSystemTz() : "?"})` : tz.label;
    return `<option value="${tz.id}" ${tz.id === STATE.tz ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
  // #app-header is inside .top-nav-controls — render controls only
  header.innerHTML = `
    ${myTeam ? `<span class="header-team-btn"><span class="team-flag">${myTeam.flag}</span><span class="team-name">${teamName(myTeam.code)}</span></span>` : ""}
    <select class="lang-select tz-select" id="tz-select" aria-label="Timezone" title="Timezone">${tzOpts}</select>
    <select class="lang-select" id="lang-select" aria-label="Language">${langOpts}</select>
  `;
  document.getElementById("lang-select").addEventListener("change", (e) => {
    const newLang = e.target.value;
    localStorage.setItem("wc_lang", newLang);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", newLang);
    window.location.href = url.toString();
  });
  const tzSel = document.getElementById("tz-select");
  if (tzSel) tzSel.addEventListener("change", (e) => {
    STATE.tz = e.target.value;
    if (window.setStoredTz) window.setStoredTz(e.target.value);
    renderHero();
  });
}

function currentTz() {
  return window.resolveTz ? window.resolveTz(STATE.tz) : (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
}

/* ============================================
   HERO (teams + score + venue + kickoff)
   ============================================ */
function renderHero() {
  const m = STATE.match;
  const home = teamByCode(m.home_code);
  const away = teamByCode(m.away_code);
  const dt = matchTimeUTC(m);
  const isFuture = dt.getTime() > Date.now();

  document.getElementById("md-stage").textContent =
    (m.stage || "Group Stage") + (m.group ? ` · ${t("md_group")} ${m.group}` : "");

  document.getElementById("md-home-flag").textContent = home.flag;
  document.getElementById("md-home-name").innerHTML = `<a href="/teams/${teamSlug(home.code)}" style="color:inherit;text-decoration:none">${teamName(home.code)}</a>`;
  document.getElementById("md-home-code").textContent = home.code;

  document.getElementById("md-away-flag").textContent = away.flag;
  document.getElementById("md-away-name").innerHTML = `<a href="/teams/${teamSlug(away.code)}" style="color:inherit;text-decoration:none">${teamName(away.code)}</a>`;
  document.getElementById("md-away-code").textContent = away.code;

  const scoreEl = document.getElementById("md-score-display");
  if (isFuture) {
    scoreEl.innerHTML = `<span class="md-vs">${t("match_vs")}</span>`;
    scoreEl.classList.add("md-score-future");
  } else {
    // No real score data in v1 — show TBD
    scoreEl.innerHTML = `<span class="md-vs">${t("match_vs")}</span>`;
  }

  const kickoffStr = window.formatInTz
    ? window.formatInTz(dt, currentTz(), STATE.lang, { withDate: true, withWeekday: true, withYear: true, long: true })
    : new Intl.DateTimeFormat(localeForIntl(STATE.lang), {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: STATE.lang === "en",
      }).format(dt);
  document.getElementById("md-kickoff").innerHTML = isFuture
    ? `<span class="md-kick-label">${t("md_kickoff")}</span><br><strong>${kickoffStr}</strong>`
    : `<span class="md-kick-label">${t("md_finished")}</span>`;

  document.getElementById("md-venue").innerHTML =
    `📍 <strong>${stadiumName(m.stadium)}</strong>, ${cityName(m.city)}`;
}

/* ============================================
   PREVIEW — rich JSON if available, else fallback template
   ============================================ */
function renderPreview() {
  const m = STATE.match;
  const home = teamByCode(m.home_code);
  const away = teamByCode(m.away_code);
  const homeConf = home.confederation || "—";
  const awayConf = away.confederation || "—";

  const cardsHtml = `
    <div class="md-preview-grid">
      <div class="md-preview-card">
        <div class="md-prev-flag">${home.flag}</div>
        <div class="md-prev-name">${teamName(home.code)}</div>
        <div class="md-prev-meta">${t("md_confederation")}: ${homeConf}</div>
        <div class="md-prev-meta">${t("md_group")}: ${home.group || "—"}</div>
      </div>
      <div class="md-preview-vs">${t("match_vs")}</div>
      <div class="md-preview-card">
        <div class="md-prev-flag">${away.flag}</div>
        <div class="md-prev-name">${teamName(away.code)}</div>
        <div class="md-prev-meta">${t("md_confederation")}: ${awayConf}</div>
        <div class="md-prev-meta">${t("md_group")}: ${away.group || "—"}</div>
      </div>
    </div>
  `;

  const key = `${m.home_code}-${m.away_code}-${m.date_local}`;
  const rich = DATA.previews[key];
  const i18nRich = (DATA.previewsI18n || {})[key];

  // For each section, prefer translated text in STATE.lang; fallback to English from previews.json
  const localized = (section) => {
    if (STATE.lang !== "en" && i18nRich && i18nRich[section] && i18nRich[section][STATE.lang]) {
      return i18nRich[section][STATE.lang];
    }
    return rich ? rich[section] : "";
  };

  let body = "";
  if (rich && (rich.head_to_head || rich.form_and_ranking || rich.what_to_expect)) {
    const block = (titleKey, text) => text
      ? `<div class="md-preview-block"><h4>${t(titleKey)}</h4><p>${escapeHtml(text)}</p></div>`
      : "";
    const sources = Array.isArray(rich.sources) && rich.sources.length
      ? `<div class="md-preview-sources"><strong>${t("md_sources_title")}:</strong> ${rich.sources
          .map((u) => `<a href="${escapeAttr(u)}" target="_blank" rel="noopener nofollow">${escapeHtml(shortDomain(u))}</a>`)
          .join(" ")}</div>`
      : "";
    body = `
      <div class="md-preview-blocks">
        ${block("md_h2h_title", localized("head_to_head"))}
        ${block("md_form_title", localized("form_and_ranking"))}
        ${block("md_outlook_title", localized("what_to_expect"))}
        ${sources}
      </div>
    `;
  } else {
    body = `<p class="md-preview-text">${previewText(home, away)}</p>`;
  }

  document.getElementById("md-preview").innerHTML = cardsHtml + body;
}

function previewText(home, away) {
  // Fallback template — use replaceAll because {home}/{away} may appear multiple times
  return t("md_preview_template")
    .replaceAll("{home}", teamName(home.code))
    .replaceAll("{away}", teamName(away.code))
    .replaceAll("{home_conf}", home.confederation || "—")
    .replaceAll("{away_conf}", away.confederation || "—");
}

function shortDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch { return url; }
}

/* ============================================
   COACHES
   ============================================ */
function renderCoaches() {
  const m = STATE.match;
  const homeC = DATA.coaches[m.home_code];
  const awayC = DATA.coaches[m.away_code];

  const card = (code, c) => {
    if (!c) return `<div class="md-coach-card md-empty">${t("md_no_data")}</div>`;
    const i18n = DATA.coachesI18n[code];
    const lang = STATE.lang;
    const name = (i18n && i18n.name && i18n.name[lang]) || c.name || "—";
    const bio = (i18n && i18n.bio && i18n.bio[lang]) || c.bio_en || "";
    let trophies = c.trophies;
    if (i18n && i18n.trophies && Array.isArray(i18n.trophies[lang]) && i18n.trophies[lang].length) {
      trophies = i18n.trophies[lang];
    }
    return `
      <div class="md-coach-card">
        <div class="md-coach-flag">${teamByCode(code).flag}</div>
        <div class="md-coach-info">
          <h3>${escapeHtml(name)}</h3>
          <div class="md-coach-meta">
            ${c.age ? `<span>${c.age} ${t("md_years_old")}</span>` : ""}
            ${c.since ? `<span>${t("md_since")} ${c.since}</span>` : ""}
          </div>
          ${bio ? `<p class="md-coach-bio">${escapeHtml(bio)}</p>` : ""}
          ${Array.isArray(trophies) && trophies.length
            ? `<div class="md-trophies">🏆 ${trophies.map(escapeHtml).join(" · ")}</div>`
            : ""}
        </div>
      </div>
    `;
  };

  document.getElementById("md-coaches").innerHTML = `
    ${card(m.home_code, homeC)}
    ${card(m.away_code, awayC)}
  `;
}

/* ============================================
   SQUADS (group by position)
   ============================================ */
function renderSquads() {
  const m = STATE.match;
  const homeRaw = DATA.squads[m.home_code];
  const awayRaw = DATA.squads[m.away_code];
  const home = Array.isArray(homeRaw) ? homeRaw : (homeRaw?.key_players || homeRaw?.players || []);
  const away = Array.isArray(awayRaw) ? awayRaw : (awayRaw?.key_players || awayRaw?.players || []);

  document.getElementById("md-squads").innerHTML = `
    <div class="md-squad-col">
      <h3>${teamByCode(m.home_code).flag} ${teamName(m.home_code)}</h3>
      ${renderSquadList(home)}
    </div>
    <div class="md-squad-col">
      <h3>${teamByCode(m.away_code).flag} ${teamName(m.away_code)}</h3>
      ${renderSquadList(away)}
    </div>
  `;
}

function renderSquadList(squad) {
  if (!Array.isArray(squad) || squad.length === 0) {
    return `<p class="md-empty">${t("md_no_data")}</p>`;
  }
  // group by position
  const groups = { GK: [], DF: [], MF: [], FW: [] };
  squad.forEach((p) => {
    const pos = (p.position || "").toUpperCase();
    if (groups[pos]) groups[pos].push(p);
    else (groups.MF = groups.MF || []).push(p);
  });
  const labels = { GK: t("md_pos_gk"), DF: t("md_pos_df"), MF: t("md_pos_mf"), FW: t("md_pos_fw") };

  return Object.keys(groups)
    .filter((g) => groups[g].length)
    .map(
      (g) => `
      <div class="md-pos-group">
        <h4>${labels[g]}</h4>
        <ul>
          ${groups[g]
            .map((p) => {
              const isCap = p.captain || p.is_captain;
              const apps = p.apps ?? p.appearances ?? 0;
              const captain = isCap ? ' <span class="md-captain">© ' + t("md_captain") + "</span>" : "";
              const clubName = p.club
                ? ((DATA.clubsI18n[p.club] && DATA.clubsI18n[p.club][STATE.lang]) || p.club)
                : "";
              const club = clubName ? `<span class="md-club">${escapeHtml(clubName)}</span>` : "";
              const num = p.number ? `<span class="md-num">#${p.number}</span>` : "";
              const stats = (apps || p.goals)
                ? `<span class="md-stats">${apps} ${t("md_apps")} · ${p.goals || 0} ${t("md_goals")}</span>`
                : "";
              return `<li>${num} <strong>${escapeHtml(p.name)}</strong>${captain} ${club} ${stats}</li>`;
            })
            .join("")}
        </ul>
      </div>
    `
    )
    .join("");
}

/* ============================================
   LIVE ODDS (calls /api/odds)
   ============================================ */
async function loadOdds() {
  const cont = document.getElementById("md-odds");
  const cta = document.getElementById("md-odds-cta");

  // Clear the static "Loading live odds…" placeholder immediately
  cont.innerHTML = "";

  // Always show the trade button (with affiliate)
  if (STATE.pmLink) {
    const sep = STATE.pmLink.polymarket_url.includes("?") ? "&" : "?";
    cta.href = `${STATE.pmLink.polymarket_url}${sep}via=${POLYMARKET_REF}`;
    cta.style.display = "inline-block";
  } else {
    // No direct link → fallback search
    const home = teamByCode(STATE.match.home_code).name_en;
    const away = teamByCode(STATE.match.away_code).name_en;
    cta.href = `https://polymarket.com/search?_q=${encodeURIComponent(home + " " + away)}&via=${POLYMARKET_REF}`;
    cta.style.display = "inline-block";
  }

  if (!STATE.pmLink || !STATE.pmLink.polymarket_slug) {
    cont.innerHTML = `<p class="md-odds-na">${t("md_odds_unavailable")}</p>`;
    return;
  }

  // Show fallback data first so users always see something
  const fallbackEarly = await loadOddsFallback();
  if (fallbackEarly) {
    renderOdds(fallbackEarly);
    renderSparkline(fallbackEarly);
  }

  // Then fetch live data and update
  try {
    const r = await fetchWithTimeout(`/api/odds?slug=${encodeURIComponent(STATE.pmLink.polymarket_slug)}&history=0`, 9000);
    if (!r.ok) throw new Error("api " + r.status);
    const data = await r.json();
    renderOdds(data);
    renderSparkline(data);
  } catch (e) {
    console.warn("live odds fetch failed, keeping fallback:", e);
    if (!fallbackEarly) {
      cont.innerHTML = `<p class="md-odds-na">${t("md_odds_unavailable")}</p>`;
      const chart = document.getElementById("md-odds-chart");
      if (chart) chart.innerHTML = "";
    }
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 8000);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadOddsFallback() {
  try {
    const slug = STATE.pmLink && STATE.pmLink.polymarket_slug;
    if (!slug) return null;
    const r = await fetchWithTimeout("/data/odds_fallback.json", 5000);
    if (!r.ok) return null;
    const data = await r.json();
    const item = data.matches && data.matches[slug];
    if (!item) return null;
    return {
      source: "fallback_estimate",
      status: item.status || "estimated",
      market_url: item.market_url,
      last_updated: item.last_updated || data.updated,
      outcomes: item.outcomes || [],
    };
  } catch (err) {
    return null;
  }
}

function renderOdds(data) {
  const cont = document.getElementById("md-odds");
  if (!data || !Array.isArray(data.outcomes) || data.outcomes.length === 0) {
    cont.innerHTML = `<p class="md-odds-na">${t("md_odds_unavailable")}</p>`;
    return;
  }
  // Sort outcomes: home, draw, away (best effort)
  const sorted = data.outcomes.slice();

  cont.innerHTML = `
    <div class="md-odds-grid">
      ${sorted
        .map(
          (o) => `
        <div class="md-odds-card">
          <div class="md-odds-name">${escapeHtml(o.name)}</div>
          <div class="md-odds-pct">${o.implied_probability_pct}%</div>
          <div class="md-odds-price">${o.price.toFixed(2)}</div>
        </div>`
        )
        .join("")}
    </div>
    <p class="md-odds-foot">${data.source === "fallback_estimate" ? "Estimate shown while live Polymarket data is unavailable" : `${t("md_odds_updated")}: ${new Date(data.last_updated).toLocaleTimeString(localeForIntl(STATE.lang))}`}</p>
  `;
}

/* ============================================
   SPARKLINE — pure SVG line chart of outcome probabilities over time
   ============================================ */
function renderSparkline(data) {
  const wrap = document.getElementById("md-odds-chart");
  if (!wrap) return;
  if (!data || !Array.isArray(data.outcomes)) { wrap.innerHTML = ""; return; }

  const series = data.outcomes
    .map((o) => ({
      name: o.name,
      history: Array.isArray(o.history) ? o.history.filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.p)) : [],
    }))
    .filter((s) => s.history.length >= 2);

  if (series.length === 0) { wrap.innerHTML = ""; return; }

  // global x range
  let tMin = Infinity, tMax = -Infinity;
  series.forEach((s) => s.history.forEach((p) => {
    if (p.t < tMin) tMin = p.t;
    if (p.t > tMax) tMax = p.t;
  }));
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax === tMin) { wrap.innerHTML = ""; return; }

  const W = 600, H = 220;
  const padL = 38, padR = 12, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xScale = (t) => padL + ((t - tMin) / (tMax - tMin)) * innerW;
  const yScale = (p) => padT + (1 - Math.max(0, Math.min(1, p))) * innerH;

  const colors = ["#22d3ee", "#ec4899", "#6366f1", "#fbbf24", "#34d399", "#f97316"];

  // grid lines for 0/25/50/75/100%
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const y = yScale(p);
    return `<line x1="${padL}" y1="${y}" x2="${padL + innerW}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
            <text x="${padL - 6}" y="${y + 3}" fill="rgba(255,255,255,0.45)" font-size="9" text-anchor="end">${Math.round(p * 100)}%</text>`;
  }).join("");

  const paths = series.map((s, i) => {
    const color = colors[i % colors.length];
    const d = s.history
      .slice()
      .sort((a, b) => a.t - b.t)
      .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${xScale(pt.t).toFixed(2)} ${yScale(pt.p).toFixed(2)}`)
      .join(" ");
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
  }).join("");

  const dateFmt = (ms) => {
    const d = new Date(ms);
    return d.toLocaleDateString(localeForIntl(STATE.lang), { month: "short", day: "numeric" });
  };
  const xLabels = `
    <text x="${padL}" y="${H - 8}" fill="rgba(255,255,255,0.55)" font-size="10" text-anchor="start">${escapeHtml(dateFmt(tMin))}</text>
    <text x="${padL + innerW}" y="${H - 8}" fill="rgba(255,255,255,0.55)" font-size="10" text-anchor="end">${escapeHtml(dateFmt(tMax))}</text>
  `;

  const legend = series.map((s, i) => {
    const color = colors[i % colors.length];
    return `<span class="md-odds-chart-legend-item"><span class="md-odds-chart-legend-dot" style="background:${color}"></span>${escapeHtml(s.name)}</span>`;
  }).join("");

  wrap.innerHTML = `
    <div class="md-odds-chart-title">${t("md_odds_chart_title")}</div>
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      ${gridLines}
      ${paths}
      ${xLabels}
    </svg>
    <div class="md-odds-chart-legend">${legend}</div>
  `;
}

function escapeAttr(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============================================
   SEO META (dynamic title, description, og, ld+json)
   ============================================ */
function renderSeoMeta() {
  const m = STATE.match;
  const home = teamName(m.home_code);
  const away = teamName(m.away_code);
  const dt = matchTimeUTC(m);
  const date = new Intl.DateTimeFormat(localeForIntl(STATE.lang), {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(dt);

  const title = `${home} ${t("match_vs")} ${away} — ${date} | World Cup 2026`;
  const desc = t("md_meta_desc")
    .replace("{home}", home)
    .replace("{away}", away)
    .replace("{date}", date)
    .replace("{venue}", `${stadiumName(m.stadium)}, ${cityName(m.city)}`);

  document.title = title;
  document.getElementById("page-title").textContent = title;
  document.getElementById("page-desc").setAttribute("content", desc);
  document.getElementById("og-title").setAttribute("content", title);
  document.getElementById("og-desc").setAttribute("content", desc);

  // Canonical
  const slug = `${m.home_code.toLowerCase()}-${m.away_code.toLowerCase()}-${m.date_local}`;
  document.getElementById("page-canonical").setAttribute("href", `https://www.wcschedules.com/match/${slug}`);

  // Schema.org SportsEvent
  const ld = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${home} vs ${away}`,
    startDate: dt.toISOString(),
    sport: "Football",
    eventStatus: dt.getTime() > Date.now() ? "https://schema.org/EventScheduled" : "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: m.stadium,
      address: { "@type": "PostalAddress", addressLocality: m.city },
    },
    competitor: [
      { "@type": "SportsTeam", name: teamByCode(m.home_code).name_en },
      { "@type": "SportsTeam", name: teamByCode(m.away_code).name_en },
    ],
    superEvent: { "@type": "SportsEvent", name: "FIFA World Cup 2026" },
  };
  document.getElementById("ld-event").textContent = JSON.stringify(ld);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
