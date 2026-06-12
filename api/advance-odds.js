// api/advance-odds.js — Vercel serverless function
// Proxies Polymarket's "Team to advance to Knockout Stages" event.
// Each market's first outcomePrice is the live YES probability that the
// team reaches the knockout stage (a real advancement probability — unlike
// champion odds, which earlier produced nonsense like "Mexico 100%").
// GET /api/advance-odds → { markets: [{team, prob, prob_pct}], updated, source }

const EVENT_SLUG = "world-cup-team-to-advance-to-knockout-stages";
const GAMMA_URL = `https://gamma-api.polymarket.com/events?slug=${EVENT_SLUG}`;
const CACHE_TTL = 120; // seconds — Vercel CDN cache

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
        const prob = Array.isArray(prices) && prices.length > 0 ? parseFloat(prices[0]) : 0;
        return {
          team: m.groupItemTitle || "?",
          prob,
          prob_pct: Math.round(prob * 1000) / 10,
        };
      })
      .filter((m) => m.team && m.team !== "?")
      .sort((a, b) => b.prob - a.prob);

    if (!markets.length) throw new Error("empty markets");

    return res.status(200).json({
      markets,
      updated: new Date().toISOString(),
      event_slug: EVENT_SLUG,
      source: "polymarket",
    });
  } catch (err) {
    console.error("advance-odds error:", err.message);
    return res.status(200).json({ markets: [], source: "error", error: err.message });
  }
};
