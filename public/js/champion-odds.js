/* ============================================
   champion-odds.js — 2026 World Cup Champion Odds
   Fetches Polymarket "2026 FIFA World Cup Winner" market.
   - Production: calls /api/champion-odds (serverless proxy, cached 2 min)
   - Local dev: calls gamma-api.polymarket.com directly (CORS open)
   Auto-refreshes every 3 minutes.
   ============================================ */

(function () {
  const GAMMA_FALLBACK =
    "https://gamma-api.polymarket.com/events?slug=world-cup-winner";
  // Localized "Trade on Polymarket" link based on the current site language.
  function ctaUrl() {
    return window.polymarketWinnerUrl
      ? window.polymarketWinnerUrl(window.__coLang, "wcschedules")
      : "https://polymarket.com/event/world-cup-winner?via=wcschedules";
  }
  const STATIC_FALLBACK = "/data/odds_fallback.json";
  const REFRESH_MS = 3 * 60 * 1000; // 3 min

  // Tier thresholds
  const TIER_FAV  = 10; // >= 10% → Favorites
  const TIER_DARK =  2; // 2–10% → Dark Horses
                        // < 2%  → Long Shots

  // Medal emoji for top 3 within Favorites tier
  const MEDAL = ["🥇", "🥈", "🥉"];

  // FIFA code → team flag (we'll cross-reference teams data)
  let _teamsCache = [];

  function flagFor(teamName) {
    // Try to find flag from loaded teams by name_en match
    const match = _teamsCache.find(
      (t) =>
        t.name_en &&
        t.name_en.toLowerCase() === teamName.toLowerCase()
    );
    return match ? match.flag : "🏳️";
  }

  function probBar(pct) {
    const w = Math.max(pct, 0.5);
    const color =
      pct >= TIER_FAV  ? "#16a34a" :
      pct >= TIER_DARK ? "#6366f1" : "#6b7280";
    return `<div class="co-bar-wrap">
      <div class="co-bar" style="width:${w}%;background:${color}"></div>
    </div>`;
  }

  function t(key) {
    const lang = window.__coLang || "en";
    const dict = (window.I18N && window.I18N[lang]) || (window.I18N && window.I18N["en"]) || {};
    return dict[key] || key;
  }

  function buildRow(m, globalRank, medalIndex) {
    const flag = flagFor(m.team);
    const medal = medalIndex < MEDAL.length
      ? `<span class="co-medal">${MEDAL[medalIndex]}</span>`
      : `<span class="co-medal co-rank-num">${globalRank}</span>`;
    const pct = typeof m.prob_pct === "number" ? m.prob_pct : Math.round(m.prob * 1000) / 10;
    const teamObj = _teamsCache.find(t => t.name_en && t.name_en.toLowerCase() === m.team.toLowerCase());
    const slug = teamObj
      ? teamObj.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/, '')
      : m.team.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `
      <li class="co-row">
        ${medal}
        <span class="co-flag">${flag}</span>
        <a href="/teams/${slug}" class="co-name" style="text-decoration:none">${escapeHtml(m.team)}</a>
        <span class="co-right">
          ${probBar(pct)}
          <span class="co-pct">${pct}%</span>
        </span>
      </li>`;
  }

  function renderList(markets, teamsData, source) {
    _teamsCache = teamsData || [];
    const root = document.getElementById("champion-odds-body");
    if (!root) return;

    // Split into tiers
    function getPct(m) {
      return typeof m.prob_pct === "number" ? m.prob_pct : Math.round(m.prob * 1000) / 10;
    }

    const favs  = markets.filter(m => getPct(m) >= TIER_FAV);
    const darks = markets.filter(m => getPct(m) >= TIER_DARK && getPct(m) < TIER_FAV);
    const longs = markets.filter(m => getPct(m) < TIER_DARK);

    function buildTier(label, items, startGlobalRank, medalOffset) {
      if (!items.length) return "";
      const rows = items.map((m, i) =>
        buildRow(m, startGlobalRank + i, medalOffset + i)
      ).join("");
      return `
        <div class="co-tier">
          <div class="co-tier-label">${label}</div>
          <ol class="co-list">${rows}</ol>
        </div>`;
    }

    const favCount  = favs.length;
    const darkCount = darks.length;

    const html =
      buildTier(t("co_tier_fav"),  favs,  1,           0) +
      buildTier(t("co_tier_dark"), darks, favCount + 1, favCount) +
      buildTier(t("co_tier_long"), longs, favCount + darkCount + 1, favCount + darkCount);

    root.innerHTML = html;

    if (source === "fallback_estimate") {
      root.insertAdjacentHTML("beforeend", `<p class="co-note">Live Polymarket data is temporarily unavailable. Showing pre-tournament estimates.</p>`);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderError(msg) {
    const root = document.getElementById("champion-odds-body");
    if (root) root.innerHTML = `<p class="co-error">${msg}</p>`;
  }

  function updateTimestamp(iso) {
    const el = document.getElementById("champion-odds-updated");
    if (!el || !iso) return;
    const lang = (window.I18N && window.__coLang) || "en";
    const locales = { "zh-CN": "zh-CN", "zh-TW": "zh-TW", en: "en-US", fr: "fr-FR", es: "es-ES", pt: "pt-BR", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU", ar: "ar-SA", id: "id-ID" };
    const locale = locales[lang] || "en-US";
    el.textContent = new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  // Parse gamma-api raw format (used in local fallback)
  function parseGammaRaw(events) {
    const ev = Array.isArray(events) ? events[0] : events;
    if (!ev || !Array.isArray(ev.markets)) return [];
    return ev.markets
      .map((m) => {
        let prices = m.outcomePrices;
        if (typeof prices === "string") { try { prices = JSON.parse(prices); } catch { prices = []; } }
        const prob = Array.isArray(prices) && prices.length ? parseFloat(prices[0]) : 0;
        return { team: m.groupItemTitle || "?", prob, prob_pct: Math.round(prob * 1000) / 10 };
      })
      .filter((m) => m.team && m.team !== "?" && !m.team.startsWith("Team "))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 20);
  }

  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadStaticFallback() {
    const r = await fetchWithTimeout(STATIC_FALLBACK);
    if (!r.ok) throw new Error("fallback " + r.status);
    const data = await r.json();
    return { markets: data.champion || [], updated: data.updated, source: "fallback_estimate" };
  }

  async function fetchAndRender(teamsData) {
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    try {
      let markets;
      if (isLocal) {
        // Direct call to gamma-api (CORS open on localhost)
        const r = await fetchWithTimeout(GAMMA_FALLBACK);
        if (!r.ok) throw new Error("gamma " + r.status);
        const raw = await r.json();
        markets = parseGammaRaw(raw);
        updateTimestamp(new Date().toISOString());
      } else {
        // Production: use serverless proxy
        const r = await fetchWithTimeout("/api/champion-odds");
        if (!r.ok) throw new Error("api " + r.status);
        const data = await r.json();
        markets = data.markets || [];
        updateTimestamp(data.updated);
        if (data.source === "fallback_estimate") {
          renderList(markets, teamsData, data.source);
          const cta = document.getElementById("champion-odds-cta");
          if (cta) cta.href = ctaUrl();
          return;
        }
      }

      if (!markets.length) throw new Error("empty");
      renderList(markets, teamsData);

      // Update CTA href
      const cta = document.getElementById("champion-odds-cta");
      if (cta) cta.href = ctaUrl();

    } catch (err) {
      console.warn("champion-odds fetch failed:", err.message);
      try {
        const fallback = await loadStaticFallback();
        updateTimestamp(fallback.updated);
        renderList(fallback.markets, teamsData, fallback.source);
      } catch (fallbackErr) {
        renderError("—");
      }
    }
  }

  // Public init: called from app.js after DATA is loaded
  window.initChampionOdds = function (teamsData, lang) {
    window.__coLang = lang || "en";
    _teamsCache = teamsData || [];
    fetchAndRender(teamsData);
    setInterval(() => fetchAndRender(teamsData), REFRESH_MS);
  };

  // Re-render tier labels on lang change (odds values stay, only labels change)
  document.addEventListener("langchange", () => {
    window.__coLang = (window.STATE && window.STATE.lang) || "en";
    // Update tier label text nodes without re-fetching
    document.querySelectorAll(".co-tier-label").forEach((el, i) => {
      const keys = ["co_tier_fav", "co_tier_dark", "co_tier_long"];
      if (keys[i]) el.textContent = t(keys[i]);
    });
  });
})();
