/* ============================================
   champion-odds.js — 2026 World Cup Champion Odds
   Fetches Polymarket "2026 FIFA World Cup Winner" market.
   - Production: calls /api/champion-odds (serverless proxy, cached 2 min)
   - Local dev: calls gamma-api.polymarket.com directly (CORS open)
   Auto-refreshes every 3 minutes.
   ============================================ */

(function () {
  const POLYMARKET_EVENT_URL =
    "https://polymarket.com/event/2026-fifa-world-cup-winner-595";
  const GAMMA_FALLBACK =
    "https://gamma-api.polymarket.com/events?slug=2026-fifa-world-cup-winner-595";
  const REFRESH_MS = 3 * 60 * 1000; // 3 min
  const TOP_N = 10;

  // Medal emoji for top 3
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
    // Visual bar: max width 100%, min 2px visible
    const w = Math.max(pct, 1);
    const color =
      pct >= 15 ? "#16a34a" :
      pct >= 8  ? "#2563eb" :
      pct >= 3  ? "#7c3aed" : "#6b7280";
    return `<div class="co-bar-wrap">
      <div class="co-bar" style="width:${w}%;background:${color}"></div>
    </div>`;
  }

  function renderList(markets, teamsData) {
    _teamsCache = teamsData || [];
    const root = document.getElementById("champion-odds-body");
    if (!root) return;

    const top = markets.slice(0, TOP_N);
    const html = top
      .map((m, i) => {
        const flag = flagFor(m.team);
        const medal = MEDAL[i] || `<span class="co-rank">${i + 1}</span>`;
        const pct = typeof m.prob_pct === "number" ? m.prob_pct : Math.round(m.prob * 1000) / 10;
        return `
          <li class="co-row">
            <span class="co-medal">${medal}</span>
            <span class="co-flag">${flag}</span>
            <span class="co-name">${escapeHtml(m.team)}</span>
            <span class="co-right">
              ${probBar(pct)}
              <span class="co-pct">${pct}%</span>
            </span>
          </li>
        `;
      })
      .join("");

    root.innerHTML = `<ol class="co-list">${html}</ol>`;
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

  async function fetchAndRender(teamsData) {
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    try {
      let markets;
      if (isLocal) {
        // Direct call to gamma-api (CORS open on localhost)
        const r = await fetch(GAMMA_FALLBACK);
        if (!r.ok) throw new Error("gamma " + r.status);
        const raw = await r.json();
        markets = parseGammaRaw(raw);
        updateTimestamp(new Date().toISOString());
      } else {
        // Production: use serverless proxy
        const r = await fetch("/api/champion-odds");
        if (!r.ok) throw new Error("api " + r.status);
        const data = await r.json();
        markets = data.markets || [];
        updateTimestamp(data.updated);
      }

      if (!markets.length) throw new Error("empty");
      renderList(markets, teamsData);

      // Update CTA href
      const cta = document.getElementById("champion-odds-cta");
      if (cta) cta.href = POLYMARKET_EVENT_URL + "?via=wcschedules";

    } catch (err) {
      console.warn("champion-odds fetch failed:", err.message);
      renderError("—");
    }
  }

  // Public init: called from app.js after DATA is loaded
  window.initChampionOdds = function (teamsData, lang) {
    window.__coLang = lang || "en";
    _teamsCache = teamsData || [];
    fetchAndRender(teamsData);
    setInterval(() => fetchAndRender(teamsData), REFRESH_MS);
  };

  // Re-render labels on lang change (odds values stay)
  document.addEventListener("langchange", () => {
    window.__coLang = (window.STATE && window.STATE.lang) || "en";
  });
})();
