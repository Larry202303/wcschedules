/* ============================================
   World Cup 2026 — Main App
   ============================================ */

// alias i18n helpers
const t = (key) => (window.t ? window.t(key, STATE.lang) : key);
const applyTranslations = (lang) => window.applyTranslations && window.applyTranslations(lang);

// Opening match: MEX vs RSA at Estadio Azteca, 2026-06-11 13:00 America/Mexico_City (CDT, UTC−6) = 19:00 UTC
const KICKOFF_UTC = new Date("2026-06-11T19:00:00Z").getTime();
const STORAGE_TEAM = "wc_my_team";
const POLYMARKET_REF = "wcschedules"; // 注册后替换为真实 referral code

let DATA = {
  teams: [],
  groups: {},
  matches: [],
  i18n: { teams: {}, cities: {}, stadiums: {} }, // localized proper nouns
  polymarketLinks: [], // [{home, away, date, polymarket_url, polymarket_slug, condition_id, neg_risk_market_id}]
};
let STATE = {
  lang: "en",
  myTeam: null,
  tz: "auto",          // raw preference; "auto" => system tz
  scheduleFilter: "all",
};

/* ============================================
   POLYMARKET CODE MAPPING
   FIFA 3-letter code → ISO 3-letter code Polymarket uses
   ============================================ */
const PM_CODE_MAP = {
  KOR: "kor", JPN: "jpn", AUS: "aus", IRN: "irn",
  USA: "usa", MEX: "mex", CAN: "can", CRC: "crc", PAN: "pan",
  // EU teams Polymarket uses ISO 3166 codes
  NED: "nld", GER: "ger", SUI: "che", CRO: "hrv", POR: "prt",
  SRB: "srb", ESP: "esp", FRA: "fra", BEL: "bel", ENG: "eng",
  SCO: "sco", NOR: "nor", DEN: "den", SWE: "swe", AUT: "aut",
  // South America
  ARG: "arg", BRA: "bra", URU: "ury", COL: "col", ECU: "ecu",
  PAR: "par", VEN: "ven", BOL: "bol",
  // Africa
  MAR: "mar", TUN: "tun", EGY: "egy", SEN: "sen", GHA: "gha",
  NGA: "nga", CIV: "civ", RSA: "rsa", ALG: "alg", CPV: "cvi",
  // Middle East
  KSA: "ksa", QAT: "qat", JOR: "jor", IRQ: "irq",
  // Other
  NZL: "nzl", HAI: "hai", JAM: "jam", CUW: "cuw", SUR: "sur",
  UZB: "uzb", COD: "cdr", UKR: "ukr", CZE: "cze", BIH: "bih",
  TUR: "tur", ITA: "ita",
};

/* ============================================
   BOOT
   ============================================ */
async function boot() {
  STATE.lang = window.detectLang();
  STATE.myTeam = localStorage.getItem(STORAGE_TEAM);
  STATE.tz = window.getStoredTz ? window.getStoredTz() : "auto";

  document.documentElement.lang = STATE.lang;
  document.documentElement.dir = window.RTL_LANGS.includes(STATE.lang) ? "rtl" : "ltr";

  try {
    const [teams, groups, matches, i18nData, pmLinks] = await Promise.all([
      fetch("data/teams.json").then((r) => r.json()),
      fetch("data/groups.json").then((r) => r.json()),
      fetch("data/matches.json").then((r) => r.json()),
      fetch("data/i18n_data.json").then((r) => r.json()).catch(() => ({ teams: {}, cities: {}, stadiums: {} })),
      fetch("data/polymarket_links.json").then((r) => r.json()).catch(() => ({ matches: [] })),
    ]);
    DATA.teams = teams;
    DATA.groups = groups;
    DATA.matches = matches;
    DATA.i18n = i18nData;
    DATA.polymarketLinks = pmLinks.matches || [];
  } catch (e) {
    console.error("Failed to load data:", e);
  }

  applyTranslations(STATE.lang);
  renderHeader();
  renderRecent();
  renderGroups();
  renderSchedule();
  bindEvents();
  initTopNav();

  // expose helpers + data for sibling modules
  window.teamName = teamName;
  window.teamSlug = teamSlug;
  window.__scorersData = { teams: DATA.teams, matches: DATA.matches };
  if (typeof window.initScorers === "function") {
    window.initScorers(DATA.teams, DATA.matches);
  }
  if (typeof window.initChampionOdds === "function") {
    window.initChampionOdds(DATA.teams, STATE.lang);
  }

  startLiveUpdates();
}

document.addEventListener("DOMContentLoaded", boot);

/* ============================================
   LIVE UPDATES — merge live scores/scorers from /api/scores
   into DATA.matches, then recompute standings/scorers/recent.
   Edge-cached server-side, so polling every 60s is free.
   ============================================ */
async function fetchLiveData() {
  try {
    const r = await fetch("/api/scores");
    if (!r.ok) return;
    const data = await r.json();
    let changed = false;

    if (Array.isArray(data.scores) && data.scores.length) {
      data.scores.forEach((sc) => {
        const m = DATA.matches.find(
          (x) => x.home_code === sc.home && x.away_code === sc.away
        );
        if (!m) return;
        if (m.home_score !== sc.hs || m.away_score !== sc.as || m.status !== sc.status) {
          m.home_score = sc.hs;
          m.away_score = sc.as;
          m.status = sc.status;
          changed = true;
        }
      });
    }

    if ((data.scorers && data.scorers.length) || (data.teamGoals && data.teamGoals.length)) {
      window.__realScorers = { players: data.scorers || [], teams: data.teamGoals || [] };
      changed = true;
    }

    if (changed) {
      renderRecent();
      renderGroups();
      renderSchedule();
      if (typeof window.refreshScorers === "function") window.refreshScorers();
    }
  } catch (e) {
    /* silent — keep showing last known / preview data */
  }
}

function startLiveUpdates() {
  fetchLiveData();
  setInterval(fetchLiveData, 60000); // 60s; cost is bounded by the 60s edge cache
}

/* ============================================
   LOCALIZED NAME HELPERS
   ============================================ */
function teamByCode(code) {
  return (
    DATA.teams.find((team) => team.code === code) || {
      code,
      name_en: code,
      flag: "⚽",
      group: "?",
    }
  );
}

function teamSlug(code) {
  const t = teamByCode(code);
  const name = (t && t.name_en) || code;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function teamName(code) {
  const entry = DATA.i18n.teams[code];
  if (entry && entry[STATE.lang]) return entry[STATE.lang];
  if (entry && entry.en) return entry.en;
  return teamByCode(code).name_en;
}

function cityName(en) {
  const entry = DATA.i18n.cities[en];
  if (entry && entry[STATE.lang]) return entry[STATE.lang];
  return en;
}

function stadiumName(en) {
  const entry = DATA.i18n.stadiums[en];
  if (entry && entry[STATE.lang]) return entry[STATE.lang];
  return en;
}

/* ============================================
   MATCH TIME (timezone conversion)
   ============================================ */
function formatMatchTime(match) {
  const [y, m, d] = match.date_local.split("-").map(Number);
  const [hh, mm] = match.time_local.split(":").map(Number);
  return zonedDateToUTC(y, m, d, hh, mm, match.timezone);
}

function zonedDateToUTC(y, m, d, hh, mm, tz) {
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = dtf.formatToParts(new Date(naive));
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  const tzY = get("year"), tzM = get("month"), tzD = get("day");
  const tzH = get("hour") === 24 ? 0 : get("hour");
  const tzMin = get("minute"), tzS = get("second");
  const tzAsUTC = Date.UTC(tzY, tzM - 1, tzD, tzH, tzMin, tzS);
  const offset = tzAsUTC - naive;
  return new Date(naive - offset);
}

function localeForIntl(lang) {
  const map = {
    "zh-CN": "zh-CN",
    "zh-TW": "zh-TW",
    en: "en-US",
    es: "es-ES",
    pt: "pt-BR",
    ja: "ja-JP",
    ko: "ko-KR",
    ru: "ru-RU",
    ar: "ar-SA",
    id: "id-ID",
  };
  return map[lang] || "en-US";
}

function currentTz() {
  return window.resolveTz ? window.resolveTz(STATE.tz) : (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
}

// YYYY-MM-DD of a UTC instant as seen in the given timezone (for date grouping).
function dateKeyInTz(date, tz) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const g = (type) => p.find((x) => x.type === type).value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

// Localized "weekday month day" header from a YYYY-MM-DD key (no extra tz shift).
function dayHeaderLabel(dateKey) {
  const d = new Date(dateKey + "T12:00:00Z");
  return new Intl.DateTimeFormat(localeForIntl(STATE.lang), {
    timeZone: "UTC", weekday: "long", month: "long", day: "numeric",
  }).format(d);
}

function formatUserLocal(date) {
  if (window.formatInTz) {
    return window.formatInTz(date, currentTz(), STATE.lang, { withDate: true, withWeekday: true });
  }
  return new Intl.DateTimeFormat(localeForIntl(STATE.lang), {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
    hour12: STATE.lang === "en",
  }).format(date);
}

// Header nav version — no weekday to prevent overflow on long-locale languages
// Header nav: no weekday, no timezone abbreviation (avoids overflow on long-locale languages)
function formatUserLocalNoWeekday(date) {
  try {
    return new Intl.DateTimeFormat(localeForIntl(STATE.lang), {
      timeZone: currentTz(),
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      hour12: STATE.lang === "en",
    }).format(date);
  } catch (e) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
      hour12: true,
    }).format(date);
  }
}

function formatUserLocalTime(date) {
  if (window.formatInTz) {
    return window.formatInTz(date, currentTz(), STATE.lang, {});
  }
  return new Intl.DateTimeFormat(localeForIntl(STATE.lang), {
    hour: "2-digit", minute: "2-digit", hour12: STATE.lang === "en",
  }).format(date);
}

function isToday(date) {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isTomorrow(date) {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/* ============================================
   POLYMARKET URL RESOLUTION
   - First try exact match against polymarket_links.json (using PM code map)
   - Then try ±1 day window (timezone differences)
   - Fallback: search URL
   ============================================ */
function findPolymarketLink(match) {
  const pmHome = PM_CODE_MAP[match.home_code] || match.home_code.toLowerCase();
  const pmAway = PM_CODE_MAP[match.away_code] || match.away_code.toLowerCase();
  const date = match.date_local;

  // Try exact match first
  let hit = DATA.polymarketLinks.find(
    (p) =>
      p.home.toLowerCase() === pmHome &&
      p.away.toLowerCase() === pmAway &&
      p.date === date
  );
  if (hit) return hit;

  // Try ±1 day (timezone issue: Polymarket may use UTC date)
  const [y, m, d] = date.split("-").map(Number);
  for (const offset of [-1, 1]) {
    const dt = new Date(Date.UTC(y, m - 1, d + offset));
    const altDate = dt.toISOString().slice(0, 10);
    hit = DATA.polymarketLinks.find(
      (p) =>
        p.home.toLowerCase() === pmHome &&
        p.away.toLowerCase() === pmAway &&
        p.date === altDate
    );
    if (hit) return hit;
  }
  return null;
}

function polymarketUrlFor(match) {
  const hit = findPolymarketLink(match);
  if (hit && hit.polymarket_url) {
    // Append affiliate (?via=) parameter
    const sep = hit.polymarket_url.includes("?") ? "&" : "?";
    return `${hit.polymarket_url}${sep}via=${POLYMARKET_REF}`;
  }
  // Fallback: site-wide search
  const home = teamByCode(match.home_code).name_en;
  const away = teamByCode(match.away_code).name_en;
  const q = encodeURIComponent(`${home} ${away} World Cup`);
  return `https://polymarket.com/search?_q=${q}&via=${POLYMARKET_REF}`;
}

function kalshiUrlFor(match) {
  // Kalshi has no per-match WC page yet; use proper search route /search?query=
  const home = teamByCode(match.home_code).name_en;
  const away = teamByCode(match.away_code).name_en;
  const q = encodeURIComponent(`${home} ${away}`);
  return `https://kalshi.com/search?query=${q}&referral=${KALSHI_REF}`;
}

/* ============================================
   MATCH SLUG (for /match/:slug detail URL)
   ============================================ */
function matchSlug(m) {
  // e.g. ARG-FRA-2026-06-22
  return `${m.home_code.toLowerCase()}-${m.away_code.toLowerCase()}-${m.date_local}`;
}

function matchDetailHref(m) {
  return `/match/${matchSlug(m)}?lang=${STATE.lang}`;
}

/* ============================================
   HEADER
   ============================================ */
function renderHeader() {
  const header = document.getElementById("app-header");
  if (!header) return;

  const myTeam = STATE.myTeam ? teamByCode(STATE.myTeam) : null;
  const nextMatch = myTeam ? findNextMatchFor(myTeam.code) : null;

  let teamHTML;
  if (myTeam) {
    const nextHtml = nextMatch
      ? `<span class="header-next-match">${t("nav_next_match")}: ${formatUserLocalNoWeekday(formatMatchTime(nextMatch))}</span>`
      : "";
    teamHTML = `
      <button class="header-team-btn" id="btn-change-team">
        <span class="team-flag">${myTeam.flag}</span>
        <span class="team-name">${teamName(myTeam.code)}</span>
        ${nextHtml}
      </button>
    `;
  } else {
    teamHTML = `
      <button class="header-cta" id="btn-pick-team">
        ⚽ ${t("nav_pick_team")}
      </button>
    `;
  }

  const langOptions = window.LANG_LIST.map(
    (l) =>
      `<option value="${l.code}" ${l.code === STATE.lang ? "selected" : ""}>${l.flag} ${l.name}</option>`
  ).join("");

  const tzOptions = (window.TIMEZONE_LIST || []).map((tz) => {
    const isAuto = tz.id === "auto";
    const label = isAuto ? `${tz.label} (${window.getSystemTz ? window.getSystemTz() : "?"})` : tz.label;
    return `<option value="${tz.id}" ${tz.id === STATE.tz ? "selected" : ""}>${escapeHtmlSafe(label)}</option>`;
  }).join("");

  // #app-header is now inside .top-nav-controls (right side of sticky nav)
  header.innerHTML = `
    ${teamHTML}
    <select class="lang-select tz-select" id="tz-select" aria-label="Timezone" title="Timezone">
      ${tzOptions}
    </select>
    <select class="lang-select" id="lang-select" aria-label="Language">
      ${langOptions}
    </select>
  `;
}

function escapeHtmlSafe(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function findNextMatchFor(code) {
  const now = Date.now();
  const future = DATA.matches
    .filter((m) => m.home_code === code || m.away_code === code)
    .map((m) => ({ m, ts: formatMatchTime(m).getTime() }))
    .filter((x) => x.ts > now)
    .sort((a, b) => a.ts - b.ts);
  return future.length ? future[0].m : null;
}

/* ============================================
   COUNTDOWN
   ============================================ */
function renderCountdown() {
  // Countdown always targets the opening match (MEX vs RSA), regardless of myTeam selection.
  const target = KICKOFF_UTC;
  const diff = target - Date.now();

  const els = {
    days: document.getElementById("cd-days"),
    hours: document.getElementById("cd-hours"),
    mins: document.getElementById("cd-mins"),
    secs: document.getElementById("cd-secs"),
    label: document.getElementById("cd-label"),
  };
  if (!els.days) return;

  if (diff <= 0) {
    els.days.textContent = "00";
    els.hours.textContent = "00";
    els.mins.textContent = "00";
    els.secs.textContent = "00";
    return;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  els.days.textContent = String(days).padStart(2, "0");
  els.hours.textContent = String(hours).padStart(2, "0");
  els.mins.textContent = String(mins).padStart(2, "0");
  els.secs.textContent = String(secs).padStart(2, "0");

  // Label always shows the opening match (MEX vs RSA).
  if (els.label) {
    const mex = teamByCode("MEX");
    const rsa = teamByCode("RSA");
    if (mex && rsa) {
      els.label.innerHTML = `${mex.flag} ${teamName("MEX")} ${t("match_vs")} ${teamName("RSA")} ${rsa.flag}`;
    }
  }
}

/* ============================================
   GROUPS
   ============================================ */
function renderGroups() {
  const c = document.getElementById("groups-grid");
  if (!c) return;
  const keys = Object.keys(DATA.groups).sort();
  c.innerHTML = keys
    .map((k) => {
      // Compute standings (preview before kickoff, real after)
      const standings = window.computeGroupStandings
        ? window.computeGroupStandings(DATA.teams, DATA.matches, k)
        : DATA.groups[k].teams.map((code) => ({ code, points: 0, preview: true }));

      const isPreview = standings.length && standings[0].preview;
      const rows = standings
        .map((row, idx) => {
          const team = teamByCode(row.code);
          const isMine = row.code === STATE.myTeam;
          const rank = idx + 1;
          return `
            <li ${isMine ? 'class="my-team-row"' : ""} data-team="${row.code}">
              <span class="gc-rank">${rank}</span>
              <span class="team-flag-sm">${team.flag}</span>
              <a href="/teams/${teamSlug(row.code)}" class="team-name-sm" style="color:inherit;text-decoration:none">${teamName(row.code)}</a>
              <span class="gc-pts">${row.points}</span>
            </li>
          `;
        })
        .join("");

      return `
      <div class="group-card group-card-clickable" data-group="${k}" role="button" tabindex="0" aria-label="${t("md_group")} ${k}">
        <h4>${t("md_group")} ${k} <span class="group-card-chev">›</span></h4>
        <div class="gc-thead">
          <span class="gc-thead-rank">#</span>
          <span class="gc-thead-team">${t("st_team") || "Team"}</span>
          <span class="gc-thead-pts">${t("st_pts") || "Pts"}</span>
        </div>
        <ul>${rows}</ul>
        <div class="group-card-foot">
          ${isPreview ? `<span class="gc-preview-tag">${t("st_preview") || "Preview"}</span>` : ""}
          ${t("group_view_matches") || "View matches →"}
        </div>
      </div>
    `;
    })
    .join("");
}

/* ============================================
   GROUP DETAIL — navigate to dedicated page
   ============================================ */
function navigateToGroup(groupKey) {
  const lang = STATE.lang || "en";
  const tz = STATE.tz || "";
  const params = new URLSearchParams();
  if (lang && lang !== "en") params.set("lang", lang);
  if (tz) params.set("tz", tz);
  const qs = params.toString();
  window.location.href = `/groups/${groupKey.toLowerCase()}/${qs ? `?${qs}` : ""}`;
}

/* ============================================
   SCHEDULE
   ============================================ */
function renderSchedule() {
  const c = document.getElementById("schedule-list");
  if (!c) return;

  let matches = DATA.matches.slice();

  if (STATE.scheduleFilter === "today") {
    matches = matches.filter((m) => isToday(formatMatchTime(m)));
  } else if (STATE.scheduleFilter === "tomorrow") {
    matches = matches.filter((m) => isTomorrow(formatMatchTime(m)));
  } else if (STATE.scheduleFilter === "myteam" && STATE.myTeam) {
    matches = matches.filter(
      (m) => m.home_code === STATE.myTeam || m.away_code === STATE.myTeam
    );
  }

  matches.sort((a, b) => formatMatchTime(a) - formatMatchTime(b));

  if (matches.length === 0) {
    c.innerHTML = `<div class="schedule-empty">${t("schedule_no_team")}</div>`;
    return;
  }

  // Group by date — in the user's selected timezone, so the day header
  // matches the converted kickoff time (e.g. 03:00 GMT+8 belongs to the next day).
  const tz = currentTz();
  const byDate = {};
  matches.forEach((m) => {
    const key = dateKeyInTz(formatMatchTime(m), tz);
    byDate[key] = byDate[key] || [];
    byDate[key].push(m);
  });

  c.innerHTML = Object.keys(byDate)
    .sort()
    .map((dateKey) => {
      const headLabel = dayHeaderLabel(dateKey);
      return `
      <div class="schedule-day">
        <h3 class="schedule-day-head">${headLabel}</h3>
        <div class="schedule-matches">
          ${byDate[dateKey].map((m) => renderMatchCard(m)).join("")}
        </div>
      </div>
    `;
    })
    .join("");
}

function renderMatchCard(m) {
  const home = teamByCode(m.home_code);
  const away = teamByCode(m.away_code);
  const dt = formatMatchTime(m);
  const isMine =
    STATE.myTeam && (m.home_code === STATE.myTeam || m.away_code === STATE.myTeam);
  const timeStr = formatUserLocalTime(dt);

  const polyUrl = polymarketUrlFor(m);
  const detailUrl = matchDetailHref(m);

  const hasScore = m.home_score != null && m.away_score != null;
  const live = m.status === "IN_PLAY" || m.status === "PAUSED";
  const centerHtml = hasScore
    ? `<div class="match-vs match-score">${m.home_score} - ${m.away_score}</div>`
    : `<div class="match-vs">${t("match_vs")}</div>`;

  return `
    <article class="match-card ${isMine ? "match-mine" : ""}">
      <a href="${detailUrl}" class="match-card-link" aria-label="${teamName(home.code)} ${t("match_vs")} ${teamName(away.code)}">
        <div class="match-time">
          <span class="match-clock">${live ? "🔴 LIVE" : timeStr}</span>
          <span class="match-group">${m.group ? `${t("md_group")} ${m.group}` : m.stage}</span>
        </div>
        <div class="match-teams">
          <div class="match-team">
            <span class="match-flag">${home.flag}</span>
            <span class="match-name">${teamName(home.code)}</span>
          </div>
          ${centerHtml}
          <div class="match-team">
            <span class="match-flag">${away.flag}</span>
            <span class="match-name">${teamName(away.code)}</span>
          </div>
        </div>
        <div class="match-venue">📍 ${stadiumName(m.stadium)}, ${cityName(m.city)}</div>
        <div class="match-details-cta">${t("match_view_details")} →</div>
      </a>
      <div class="match-bets">
        <a href="${polyUrl}" target="_blank" rel="noopener nofollow sponsored" class="bet-btn bet-poly">
          ${t("match_bet_polymarket")} ↗
        </a>
      </div>
    </article>
  `;
}

/* ============================================
   PICK TEAM MODAL
   ============================================ */
function openPickTeamModal() {
  const modal = document.getElementById("pick-team-modal");
  if (!modal) return;
  modal.style.display = "flex";
  renderPickTeamGrid("");
  setTimeout(() => document.getElementById("pick-search")?.focus(), 100);
}

function closePickTeamModal() {
  const modal = document.getElementById("pick-team-modal");
  if (modal) modal.style.display = "none";
}

function renderPickTeamGrid(searchTerm) {
  const grid = document.getElementById("pick-grid");
  if (!grid) return;
  const q = (searchTerm || "").toLowerCase().trim();
  let teams = DATA.teams.slice().sort((a, b) => teamName(a.code).localeCompare(teamName(b.code)));
  if (q) {
    teams = teams.filter(
      (team) =>
        teamName(team.code).toLowerCase().includes(q) ||
        team.name_en.toLowerCase().includes(q) ||
        team.code.toLowerCase().includes(q)
    );
  }

  grid.innerHTML = teams
    .map(
      (team) => `
    <button class="pick-team-card" data-team="${team.code}">
      <span class="pick-flag">${team.flag}</span>
      <span class="pick-name">${teamName(team.code)}</span>
      <span class="pick-group">${t("md_group")} ${team.group}</span>
    </button>
  `
    )
    .join("");
}

function selectTeam(code) {
  STATE.myTeam = code;
  localStorage.setItem(STORAGE_TEAM, code);
  closePickTeamModal();
  renderHeader();
  renderGroups();
  renderSchedule();
  renderCountdown();
}

/* ============================================
   EVENTS
   ============================================ */
function bindEvents() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("#btn-pick-team") || e.target.closest("#btn-change-team")) {
      openPickTeamModal();
    }
    if (e.target.closest(".pick-close, .modal-backdrop")) {
      closePickTeamModal();
    }
    const card = e.target.closest(".pick-team-card");
    if (card) selectTeam(card.dataset.team);

    const filterBtn = e.target.closest("[data-filter]");
    if (filterBtn) {
      STATE.scheduleFilter = filterBtn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((b) =>
        b.classList.toggle("active", b === filterBtn)
      );
      renderSchedule();
    }

    // Group card click → navigate to group detail page
    const groupCard = e.target.closest(".group-card-clickable");
    if (groupCard && !e.target.closest("a[href^='/teams/']")) {
      navigateToGroup(groupCard.dataset.group);
    }
  });

  // Keyboard support for group cards (Enter/Space)
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("group-card-clickable")) {
      e.preventDefault();
      navigateToGroup(e.target.dataset.group);
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "lang-select") {
      STATE.lang = e.target.value;
      window.setLang(e.target.value);
      renderHeader();
      renderGroups();
      renderRecent();
      renderSchedule();
    }
    if (e.target.id === "tz-select") {
      STATE.tz = e.target.value;
      if (window.setStoredTz) window.setStoredTz(e.target.value);
      renderHeader();
      renderRecent();
      renderSchedule();
      renderCountdown();
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "pick-search") {
      renderPickTeamGrid(e.target.value);
    }
  });

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = signupForm.querySelector("input[type=email]").value.trim();
      const note = document.getElementById("signup-note");
      if (!email) return;
      try {
        const r = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, team: STATE.myTeam, lang: STATE.lang }),
        });
        if (r.ok) {
          note.textContent = t("signup_success");
          note.className = "signup-note success";
          signupForm.reset();
        } else {
          throw new Error("Subscribe failed");
        }
      } catch (err) {
        if (window.location.protocol === "file:") {
          note.textContent = t("signup_success") + " (local preview)";
          note.className = "signup-note success";
        } else {
          note.textContent = t("signup_error");
          note.className = "signup-note error";
        }
      }
    });
  }
}

/* ============================================
   RECENT MATCHES
   Shows today + tomorrow in the user's SELECTED timezone:
   both the day window and the grouping follow that timezone.
   ============================================ */
function renderRecent() {
  const c = document.getElementById("recent-list");
  if (!c) return;

  const tz = currentTz();
  const todayKey = dateKeyInTz(new Date(), tz);
  const tomorrowKey = dateKeyInTz(new Date(Date.now() + 86400000), tz);

  const windowMatches = DATA.matches
    .filter((m) => {
      const key = dateKeyInTz(formatMatchTime(m), tz);
      return key === todayKey || key === tomorrowKey;
    })
    .sort((a, b) => formatMatchTime(a) - formatMatchTime(b));

  if (windowMatches.length === 0) {
    c.innerHTML = `<div class="recent-empty">${t("recent_no_matches")}</div>`;
    return;
  }

  const byDate = {};
  windowMatches.forEach((m) => {
    const key = dateKeyInTz(formatMatchTime(m), tz);
    byDate[key] = byDate[key] || [];
    byDate[key].push(m);
  });

  c.innerHTML = Object.keys(byDate)
    .sort()
    .map((dateKey) => {
      const isToday = dateKey === todayKey;
      return `
        <div class="recent-day ${isToday ? "recent-today" : ""}">
          <h3 class="recent-day-head">
            ${isToday ? "🔴 " : ""}${dayHeaderLabel(dateKey)}
          </h3>
          <div class="recent-matches">
            ${byDate[dateKey].map((m) => renderMatchCard(m)).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

/* ============================================
   TOP NAV — hamburger + smooth scroll
   ============================================ */
function initTopNav() {
  const burger = document.getElementById("top-nav-burger");
  const links = document.getElementById("top-nav-links");
  if (!burger || !links) return;

  burger.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Close menu on link click (mobile)
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#")) {
        e.preventDefault();
        links.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
        const target = document.querySelector(href);
        if (target) {
          const offset = 64; // nav height
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }
    });
  });

  // Highlight active section on scroll
  const sections = [
    { id: "section-recent", nav: "nav_recent" },
    { id: "section-groups", nav: "nav_progress" },
    { id: "scorers-section", nav: "nav_scorers" },
    { id: "section-champion-odds", nav: "nav_champion_odds" },
    { id: "section-schedule", nav: "nav_schedule" },
  ];

  const navAnchors = {};
  links.querySelectorAll("a[href^='#']").forEach((a) => {
    navAnchors[a.getAttribute("href")] = a;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const anchor = navAnchors[`#${entry.target.id}`];
        if (anchor) anchor.classList.toggle("active", entry.isIntersecting);
      });
    },
    { rootMargin: "-60px 0px -60% 0px", threshold: 0 }
  );

  sections.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}
