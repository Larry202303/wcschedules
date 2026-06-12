/* ============================================
   Group Detail Page
   URL: /group.html?g=A&lang=xx
   ============================================ */

const STORAGE_TEAM = "wc_my_team";

let DATA = {
  teams: [],
  matches: [],
  i18n: { teams: {}, cities: {}, stadiums: {} },
};
let STATE = {
  lang: "en",
  myTeam: null,
  group: null,
  tz: "auto",
};

const t = (key) => (window.t ? window.t(key, STATE.lang) : key);

function parseGroupKey() {
  // Support pre-set key (static group pages) or URL param
  const preset = window.__GROUP_KEY__;
  if (preset) {
    const k = preset.trim().toUpperCase();
    return /^[A-L]$/.test(k) ? k : null;
  }
  const params = new URLSearchParams(window.location.search);
  const g = params.get("g") || params.get("group");
  if (!g) return null;
  const k = g.trim().toUpperCase();
  return /^[A-L]$/.test(k) ? k : null;
}

async function boot() {
  STATE.lang = window.detectLang();
  STATE.myTeam = localStorage.getItem(STORAGE_TEAM);
  STATE.tz = window.getStoredTz ? window.getStoredTz() : "auto";
  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = window.RTL_LANGS.includes(STATE.lang) ? "rtl" : "ltr";

  STATE.group = parseGroupKey();
  if (!STATE.group) return showError();

  try {
    const [teams, matches, i18nData] = await Promise.all([
      fetch("/data/teams.json").then((r) => r.json()),
      fetch("/data/matches.json").then((r) => r.json()),
      fetch("/data/i18n_data.json").then((r) => r.json()).catch(() => ({ teams: {}, cities: {}, stadiums: {} })),
    ]);
    DATA.teams = teams;
    DATA.matches = matches;
    DATA.i18n = i18nData;
  } catch (e) {
    console.error("Data load fail:", e);
    return showError();
  }

  applyTranslationsWrapper();
  renderHeader();
  if (window.initTopNav) initTopNav();
  renderHero();
  renderStandings();
  renderTeams();
  renderMatches();
  renderSeoMeta();

  document.getElementById("gp-loading").style.display = "none";
  document.getElementById("gp-content").style.display = "block";

  // Load advance odds async (non-blocking)
  renderAdvanceOdds();

  startLiveUpdates();
}

/* Live updates: merge live scores into DATA.matches → recompute standings + match list. */
async function fetchLiveData() {
  try {
    const r = await fetch("/api/scores");
    if (!r.ok) return;
    const data = await r.json();
    if (!Array.isArray(data.scores) || !data.scores.length) return;
    let changed = false;
    data.scores.forEach((sc) => {
      const m = DATA.matches.find((x) => x.home_code === sc.home && x.away_code === sc.away);
      if (!m) return;
      if (m.home_score !== sc.hs || m.away_score !== sc.as || m.status !== sc.status) {
        m.home_score = sc.hs;
        m.away_score = sc.as;
        m.status = sc.status;
        changed = true;
      }
    });
    if (changed) {
      renderStandings();
      renderMatches();
    }
  } catch (e) {
    /* silent */
  }
}

function startLiveUpdates() {
  fetchLiveData();
  setInterval(fetchLiveData, 60000);
}

function applyTranslationsWrapper() {
  if (window.applyTranslations) window.applyTranslations(STATE.lang);
}

function showError() {
  document.getElementById("gp-loading").style.display = "none";
  document.getElementById("gp-error").style.display = "block";
}

document.addEventListener("DOMContentLoaded", boot);

/* ============================================
   HELPERS
   ============================================ */
function teamByCode(code) {
  return DATA.teams.find((tm) => tm.code === code) || { code, name_en: code, flag: "⚽", group: "?" };
}
function teamName(code) {
  const entry = DATA.i18n.teams && DATA.i18n.teams[code];
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
  const entry = DATA.i18n.cities && DATA.i18n.cities[en];
  return entry && entry[STATE.lang] ? entry[STATE.lang] : en;
}

function formatMatchTime(match) {
  const [y, m, d] = match.date_local.split("-").map(Number);
  const [hh, mm] = match.time_local.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: match.timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = dtf.formatToParts(new Date(naive));
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  const tzY = get("year"), tzM = get("month"), tzD = get("day");
  const tzH = get("hour") === 24 ? 0 : get("hour");
  const tzAsUTC = Date.UTC(tzY, tzM - 1, tzD, tzH, get("minute"), get("second"));
  return new Date(naive - (tzAsUTC - naive));
}

function formatUserLocal(date) {
  const tz = window.resolveTz ? window.resolveTz(STATE.tz) : "UTC";
  return window.formatInTz(date, tz, STATE.lang, { withWeekday: true, withDate: true });
}

function matchDetailHref(m) {
  const slug = `${m.home_code.toLowerCase()}-${m.away_code.toLowerCase()}-${m.date_local}`;
  return `/match/${slug}`;
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

/* ============================================
   HEADER (mirror match.js)
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
    ${myTeam ? `<span class="header-team-btn"><span class="team-flag">${myTeam.flag}</span><span class="team-name">${escapeHtml(teamName(myTeam.code))}</span></span>` : ""}
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
    renderMatches();
  });
}

/* ============================================
   HERO
   ============================================ */
function renderHero() {
  const titleEl = document.getElementById("gp-title");
  const subEl = document.getElementById("gp-subtitle");
  if (titleEl) titleEl.innerHTML = `${t("md_group")} ${STATE.group}`;
  if (subEl) {
    const teams = DATA.teams.filter((tm) => (tm.group || "").toUpperCase() === STATE.group);
    subEl.innerHTML = teams.map((tm) => `${tm.flag} ${escapeHtml(teamName(tm.code))}`).join(" · ");
  }
}

/* ============================================
   STANDINGS table (FIFA style)
   ============================================ */
function renderStandings() {
  const c = document.getElementById("gp-standings");
  const noteEl = document.getElementById("gp-standings-note");
  if (!c) return;
  const rows = window.computeGroupStandings
    ? window.computeGroupStandings(DATA.teams, DATA.matches, STATE.group)
    : [];
  if (rows.length === 0) {
    c.innerHTML = "";
    return;
  }
  const isPreview = rows[0].preview;

  if (noteEl) {
    noteEl.innerHTML = isPreview
      ? `<span class="gp-st-preview-tag">${t("st_preview") || "Preview"}</span> ${t("st_preview_desc") || "Tournament hasn't started yet — table shown is a placeholder."}`
      : "";
  }

  const head = `
    <thead>
      <tr>
        <th class="gp-st-rank">#</th>
        <th class="gp-st-team">${t("st_team") || "Team"}</th>
        <th>${t("st_p") || "P"}</th>
        <th>${t("st_w") || "W"}</th>
        <th>${t("st_d") || "D"}</th>
        <th>${t("st_l") || "L"}</th>
        <th>${t("st_gf") || "GF"}</th>
        <th>${t("st_ga") || "GA"}</th>
        <th>${t("st_gd") || "GD"}</th>
        <th class="gp-st-pts">${t("st_pts") || "Pts"}</th>
      </tr>
    </thead>
  `;

  const body = rows.map((row, idx) => {
    const team = teamByCode(row.code);
    const rank = idx + 1;
    const isMine = row.code === STATE.myTeam;
    // Don't show advancement indicators before tournament starts
    const advance = isPreview ? "" : (rank <= 2 ? "gp-st-advance" : (rank === 3 ? "gp-st-playoff" : ""));
    const gdStr = row.gd > 0 ? `+${row.gd}` : `${row.gd}`;
    return `
      <tr class="${isMine ? "gp-st-mine " : ""}${advance}">
        <td class="gp-st-rank">${rank}</td>
        <td class="gp-st-team">
          <span class="gp-st-flag">${team.flag}</span>
          <a href="/teams/${teamSlug(row.code)}" class="gp-st-name" style="color:inherit;text-decoration:none">${escapeHtml(teamName(row.code))}</a>
        </td>
        <td>${row.played}</td>
        <td>${row.win}</td>
        <td>${row.draw}</td>
        <td>${row.loss}</td>
        <td>${row.gf}</td>
        <td>${row.ga}</td>
        <td class="gp-st-gd">${gdStr}</td>
        <td class="gp-st-pts">${row.points}</td>
      </tr>
    `;
  }).join("");

  c.innerHTML = `<table class="gp-st-table">${head}<tbody>${body}</tbody></table>`;
}

/* ============================================
   TEAMS (4 cards, click → schedule.html anchor or just info)
   ============================================ */
function renderTeams() {
  const c = document.getElementById("gp-teams");
  if (!c) return;
  const teams = DATA.teams
    .filter((tm) => (tm.group || "").toUpperCase() === STATE.group)
    .sort((a, b) => (a.name_en || "").localeCompare(b.name_en || ""));

  c.innerHTML = teams.map((tm) => `
    <a href="/teams/${teamSlug(tm.code)}" class="gp-team-card" style="text-decoration:none;color:inherit;display:block">
      <div class="gp-team-flag">${tm.flag}</div>
      <div class="gp-team-name">${escapeHtml(teamName(tm.code))}</div>
      <div class="gp-team-code">${escapeHtml(tm.code)}</div>
    </a>
  `).join("");
}

/* ============================================
   MATCHES (6 cards, click → match detail)
   ============================================ */
function renderMatches() {
  const c = document.getElementById("gp-matches");
  if (!c) return;
  const matches = DATA.matches
    .filter((m) => (m.group || "").toUpperCase() === STATE.group)
    .sort((a, b) => formatMatchTime(a) - formatMatchTime(b));

  if (matches.length === 0) {
    c.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:32px">${t("md_no_data") || "No matches."}</p>`;
    return;
  }

  c.innerHTML = matches.map((m) => {
    const home = teamByCode(m.home_code);
    const away = teamByCode(m.away_code);
    const dt = formatMatchTime(m);
    const dateStr = formatUserLocal(dt);
    const venue = `${escapeHtml(cityName(m.city))}`;
    const hasScore = m.home_score != null && m.away_score != null;
    const live = m.status === "IN_PLAY" || m.status === "PAUSED";
    const center = hasScore
      ? `<span class="gp-match-vs gp-match-score">${m.home_score} - ${m.away_score}</span>`
      : `<span class="gp-match-vs">${t("match_vs") || "vs"}</span>`;
    return `
      <a class="gp-match-row" href="${matchDetailHref(m)}">
        <div class="gp-match-time">${live ? "🔴 LIVE" : escapeHtml(dateStr)}</div>
        <div class="gp-match-teams">
          <span class="gp-match-team gp-match-home">
            <span class="gp-match-flag">${home.flag}</span>
            <span class="gp-match-name">${escapeHtml(teamName(home.code))}</span>
          </span>
          ${center}
          <span class="gp-match-team gp-match-away">
            <span class="gp-match-flag">${away.flag}</span>
            <span class="gp-match-name">${escapeHtml(teamName(away.code))}</span>
          </span>
        </div>
        <div class="gp-match-venue">${venue}</div>
        <div class="gp-match-arrow" aria-hidden="true">→</div>
      </a>
    `;
  }).join("");
}

/* ============================================
   SEO META
   ============================================ */
function renderSeoMeta() {
  const title = `${t("md_group")} ${STATE.group} — World Cup 2026`;
  document.title = title;
  const teams = DATA.teams.filter((tm) => (tm.group || "").toUpperCase() === STATE.group);
  const teamNames = teams.map((tm) => teamName(tm.code)).join(", ");
  const desc = `${title}: ${teamNames}. Full match schedule, kickoff times and live odds.`;
  const setMeta = (id, attr, val) => { const el = document.getElementById(id); if (el) el.setAttribute(attr, val); };
  setMeta("page-desc", "content", desc);
  setMeta("og-title", "content", title);
  setMeta("og-desc", "content", desc);
  setMeta("page-canonical", "href", `https://www.wcschedules.com/group.html?g=${STATE.group}`);
}

/* ============================================
   ADVANCEMENT ODDS
   Uses champion odds for teams in this group,
   converts to relative probability.
   ============================================ */
async function renderAdvanceOdds() {
  const cont = document.getElementById("gp-advance-odds");
  if (!cont) return;

  const groupTeams = DATA.teams.filter((tm) => (tm.group || "").toUpperCase() === STATE.group);
  if (!groupTeams.length) return;

  const POLYMARKET_REF = "wcschedules";

  // Live advancement probabilities (Polymarket "advance to knockout stages").
  let advData = null;
  try {
    const r = await fetch("/api/advance-odds");
    if (r.ok) advData = await r.json();
  } catch (_) {}

  if (!advData || !advData.markets || !advData.markets.length) {
    cont.innerHTML = "";
    return;
  }

  // Match group teams to their advancement market (real YES probability;
  // NOT normalized — these are independent per-team odds).
  const teamOdds = groupTeams.map((tm) => {
    const match = advData.markets.find(
      (m) => m.team && m.team.toLowerCase() === tm.name_en.toLowerCase()
    );
    const prob = match ? (typeof match.prob_pct === "number" ? match.prob_pct : Math.round(match.prob * 1000) / 10) : null;
    return { team: tm, prob };
  }).filter((x) => x.prob != null);

  if (!teamOdds.length) { cont.innerHTML = ""; return; }

  teamOdds.sort((a, b) => b.prob - a.prob);

  const rows = teamOdds.map((x) => {
    const pct = Math.round(x.prob * 10) / 10;
    const barW = Math.max(pct, 2);
    const barColor = pct >= 70 ? "#16a34a" : pct >= 40 ? "#6366f1" : "#6b7280";
    const slug = teamSlug(x.team.code);
    return `
      <div class="gpa-row">
        <span class="gpa-flag">${x.team.flag}</span>
        <a href="/teams/${slug}" class="gpa-name" style="text-decoration:none">${escapeHtml(teamName(x.team.code))}</a>
        <div class="gpa-bar-wrap">
          <div class="gpa-bar" style="width:${barW}%;background:${barColor}"></div>
        </div>
        <span class="gpa-pct">${pct}%</span>
      </div>`;
  }).join("");

  // Per-group Polymarket page (world-cup-group-{a..l}-winner), locale-aware.
  const groupSlug = `world-cup-group-${STATE.group.toLowerCase()}-winner`;
  const pmLoc = (window.PM_WINNER_LOCALES || {})[STATE.lang];
  const tradeUrl = `https://polymarket.com/${pmLoc ? pmLoc + "/" : ""}event/${groupSlug}?via=${POLYMARKET_REF}`;
  const isFallback = false;

  cont.innerHTML = `
    <div class="gpa-card">
      <div class="gpa-header">
        <span class="gpa-title">${t("gp_advance_title")}</span>
        <a href="${tradeUrl}" target="_blank" rel="noopener" class="gpa-cta">${t("gp_advance_trade")}</a>
      </div>
      <div class="gpa-rows">${rows}</div>
      <p class="gpa-note">${t("gp_advance_note")}${isFallback ? " (pre-tournament estimates)" : ""}</p>
    </div>`;

  // Re-render on lang change
  document.addEventListener("langchange", () => {
    const titleEl = cont.querySelector(".gpa-title");
    if (titleEl) titleEl.textContent = t("gp_advance_title");
    const noteEl = cont.querySelector(".gpa-note");
    if (noteEl) noteEl.textContent = t("gp_advance_note") + (isFallback ? " (pre-tournament estimates)" : "");
    const ctaEl = cont.querySelector(".gpa-cta");
    if (ctaEl) ctaEl.textContent = t("gp_advance_trade");
    // Re-render team names
    cont.querySelectorAll(".gpa-name").forEach((el, i) => {
      if (teamOdds[i]) el.textContent = teamName(teamOdds[i].team.code);
    });
  });
}
