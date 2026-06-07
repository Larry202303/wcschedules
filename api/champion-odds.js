// api/champion-odds.js — Vercel serverless function
// Proxies Polymarket Gamma API for the 2026 World Cup Winner event
// GET /api/champion-odds → { markets: [{team, prob, conditionId}], updated }

const EVENT_SLUG = "world-cup-winner";
const GAMMA_URL = `https://gamma-api.polymarket.com/events?slug=${EVENT_SLUG}`;
const CACHE_TTL = 120; // seconds — Vercel CDN cache
const FALLBACK = require("../public/data/odds_fallback.json");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=300`);

  try {
    const upstream = await fetch(GAMMA_URL, {
      headers: { "User-Agent": "wcschedules.com/1.0" },
      signal: AbortSignal.timeout(7000),
    });
    if (!upstream.ok) throw new Error(`gamma ${upstream.status}`);
    const events = await upstream.json();
    const ev = Array.isArray(events) ? events[0] : events;
    if (!ev || !Array.isArray(ev.markets)) throw new Error("no markets");

    const markets = ev.markets
      .map((m) => {
        let prices = m.outcomePrices;
        if (typeof prices === "string") {
          try { prices = JSON.parse(prices); } catch { prices = []; }
        }
        const prob = Array.isArray(prices) && prices.length > 0
          ? parseFloat(prices[0])
          : 0;
        return {
          team: m.groupItemTitle || m.question || "?",
          prob,                          // 0–1  e.g. 0.174
          prob_pct: Math.round(prob * 1000) / 10, // e.g. 17.4
          conditionId: m.conditionId || "",
          marketId: m.id || "",
        };
      })
      .filter((m) => m.team && m.team !== "?" && !m.team.startsWith("Team "))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 20); // top 20

    if (!markets.length) return sendFallback(res, "empty live markets");

    return res.status(200).json({
      markets,
      updated: new Date().toISOString(),
      event_slug: EVENT_SLUG,
      source: "polymarket",
    });
  } catch (err) {
    console.error("champion-odds error:", err.message);
    return sendFallback(res, err.message);
  }
}

function sendFallback(res, reason) {
  return res.status(200).json({
    markets: FALLBACK.champion || [],
    updated: FALLBACK.updated,
    event_slug: EVENT_SLUG,
    source: "fallback_estimate",
    fallback_reason: reason,
  });
}
