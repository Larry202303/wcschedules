/**
 * GET /api/odds?slug=fifwc-arg-fra-2026-06-22
 *   or /api/odds?condition_id=0x...
 *
 * Returns:
 *   {
 *     source, status, market_url, last_updated,
 *     outcomes: [{name, price, implied_probability_pct, token_id, history: [{t, p}, ...]}, ...]
 *   }
 *
 * Caches 60s at the edge (Vercel CDN) to save Polymarket quota.
 *
 * NOTE: For each outcome we also fetch the CLOB prices-history for charting.
 *       Capped at 50 points to keep payload tiny.
 */

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const FALLBACK = require("../public/data/odds_fallback.json");

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "wcschedules.com" },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  return res.json();
}

// Fetch history for a CLOB token id. Returns [{t (sec), p (0..1)}, ...]
// fidelity = minutes between samples; interval = max | 1m | 1w | 1d | 6h | 1h
async function fetchHistory(tokenId, fidelity, interval) {
  fidelity = fidelity || 360; // 6h sample
  interval = interval || "max";
  try {
    const url = `${CLOB}/prices-history?market=${encodeURIComponent(tokenId)}&fidelity=${fidelity}&interval=${interval}`;
    const data = await fetchJson(url);
    const hist = Array.isArray(data?.history) ? data.history : [];
    // Cap at 50 evenly-sampled points
    if (hist.length <= 50) return hist;
    const step = hist.length / 50;
    const out = [];
    for (let i = 0; i < 50; i++) {
      out.push(hist[Math.floor(i * step)]);
    }
    // Always include the very last point
    if (hist.length > 0 && out[out.length - 1] !== hist[hist.length - 1]) {
      out.push(hist[hist.length - 1]);
    }
    return out;
  } catch (e) {
    console.warn("history fetch failed for", tokenId, e.message);
    return [];
  }
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { slug, condition_id, history } = req.query || {};
  const wantHistory = history === "1" || history === "true"; // default OFF for speed
  if (!slug && !condition_id) {
    return res.status(400).json({ error: "missing slug or condition_id" });
  }

  try {
    let outcomes = [];
    let market_url = null;
    let status = "unknown";

    if (slug) {
      const events = await fetchJson(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`);
      if (!Array.isArray(events) || events.length === 0) {
        return sendFallback(req, res, slug, condition_id);
      }
      const event = events[0];
      market_url = `https://polymarket.com/event/${event.slug}`;
      status = event.closed ? "closed" : event.active ? "active" : "inactive";

      const binaryOutcomeMarkets = Array.isArray(event.markets)
        ? event.markets.filter((m) => {
            const names = safeJson(m.outcomes) || [];
            return names.length === 2 && names[0] === "Yes" && names[1] === "No" && m.groupItemTitle;
          })
        : [];

      if (binaryOutcomeMarkets.length >= 2) {
        outcomes = binaryOutcomeMarkets.map((m) => {
          const prices = safeJson(m.outcomePrices) || [];
          const tokenIds = safeJson(m.clobTokenIds) || [];
          const name = String(m.groupItemTitle || m.question || "").replace(/ \(.+\)$/, "");
          const price = parseFloat(prices[0] || 0);
          return {
            name,
            price,
            implied_probability_pct: Math.round(price * 100),
            token_id: tokenIds[0] || null,
          };
        });
        outcomes.sort(compareOutcomesForEvent(event.title));

        if (wantHistory) {
          const histories = await Promise.all(
            outcomes.map((o) => o.token_id ? fetchHistory(o.token_id) : Promise.resolve([]))
          );
          outcomes.forEach((o, i) => { o.history = histories[i]; });
        }
      } else {
        const winnerMarket = event.markets?.find((m) =>
          /winner|moneyline|to win/i.test(m.question || "")
        ) || event.markets?.[0];

        if (winnerMarket) {
        const names = safeJson(winnerMarket.outcomes) || [];
        const prices = safeJson(winnerMarket.outcomePrices) || [];
        const tokenIds = safeJson(winnerMarket.clobTokenIds) || [];
        outcomes = names.map((name, i) => ({
          name,
          price: parseFloat(prices[i] || 0),
          implied_probability_pct: Math.round((parseFloat(prices[i] || 0)) * 100),
          token_id: tokenIds[i] || null,
        }));

        if (wantHistory) {
          // Parallel fetch all outcome histories
          const histories = await Promise.all(
            outcomes.map((o) =>
              o.token_id ? fetchHistory(o.token_id) : Promise.resolve([])
            )
          );
          outcomes.forEach((o, i) => { o.history = histories[i]; });
        }
      }
      }
    } else if (condition_id) {
      const market = await fetchJson(`${CLOB}/markets/${condition_id}`);
      market_url = `https://polymarket.com/market/${condition_id}`;
      status = market.closed ? "closed" : market.active ? "active" : "inactive";
      const names = safeJson(market.outcomes) || [];
      const prices = safeJson(market.outcomePrices) || [];
      const tokenIds = Array.isArray(market.tokens)
        ? market.tokens.map((t) => t.token_id)
        : (safeJson(market.clobTokenIds) || []);
      outcomes = names.map((name, i) => ({
        name,
        price: parseFloat(prices[i] || 0),
        implied_probability_pct: Math.round((parseFloat(prices[i] || 0)) * 100),
        token_id: tokenIds[i] || null,
      }));
      if (wantHistory) {
        const histories = await Promise.all(
          outcomes.map((o) =>
            o.token_id ? fetchHistory(o.token_id) : Promise.resolve([])
          )
        );
        outcomes.forEach((o, i) => { o.history = histories[i]; });
      }
    }

    // Cache at edge for 60s, allow stale-while-revalidate for 5min
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      source: "polymarket",
      status,
      market_url,
      last_updated: new Date().toISOString(),
      outcomes,
    });
  } catch (err) {
    console.error("odds proxy err:", err);
    return sendFallback(req, res, slug, condition_id, err);
  }
};

function sendFallback(req, res, slug, conditionId, err) {
  const key = slug || findSlugByCondition(conditionId);
  const fallback = key && FALLBACK.matches && FALLBACK.matches[key];
  if (!fallback) {
    return res.status(err ? 502 : 404).json({ error: String((err && err.message) || "fallback not found") });
  }
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  return res.status(200).json({
    source: "fallback_estimate",
    status: fallback.status || "estimated",
    market_url: fallback.market_url,
    last_updated: fallback.last_updated || FALLBACK.updated,
    fallback_reason: err ? String(err.message || err) : "live market not found",
    outcomes: fallback.outcomes || [],
  });
}

function compareOutcomesForEvent(title) {
  const parts = String(title || "").split(/\s+vs\.?\s+/i);
  const home = normalizeOutcomeName(parts[0] || "");
  const away = normalizeOutcomeName(parts[1] || "");
  return (a, b) => outcomeRank(a.name, home, away) - outcomeRank(b.name, home, away);
}

function outcomeRank(name, home, away) {
  const n = normalizeOutcomeName(name);
  if (home && n.includes(home)) return 0;
  if (/^draw\b/.test(n) || n === "draw") return 1;
  if (away && n.includes(away)) return 2;
  return 3;
}

function normalizeOutcomeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findSlugByCondition(conditionId) {
  if (!conditionId) return null;
  return Object.keys(FALLBACK.matches || {}).find((key) => {
    const item = FALLBACK.matches[key];
    return item && item.condition_id === conditionId;
  });
}

function safeJson(s) {
  if (Array.isArray(s)) return s;
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
