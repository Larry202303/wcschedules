// api/scores.js — live World Cup results + scorers proxy (football-data.org)
//
// Returns normalized live data the front-end merges into matches.json so
// standings.js / scorers.js recompute real tables. Edge-cached for 60s, so the
// upstream API is hit at most ~1×/min regardless of traffic (free-tier safe).
//
// Setup: add env var FOOTBALL_DATA_KEY in Vercel (free key from football-data.org).
// Output: { scores:[{home,away,hs,as,status}], scorers:[{player,team_code,goals}],
//           teamGoals:[{team_code,goals}], updated, source }

const TEAMS = require("../public/data/teams.json");
const BASE = "https://api.football-data.org/v4/competitions/WC";
const CACHE = 60; // seconds at the Vercel edge

// Map football-data team (tla / name) -> our FIFA site code.
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
const byTla = {};
const byName = {};
for (const t of TEAMS) {
  if (t.code) byTla[t.code.toUpperCase()] = t.code;
  if (t.name_en) byName[norm(t.name_en)] = t.code;
}
function siteCode(team) {
  if (!team) return null;
  if (team.tla && byTla[team.tla.toUpperCase()]) return byTla[team.tla.toUpperCase()];
  if (team.name && byName[norm(team.name)]) return byName[norm(team.name)];
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", `public, s-maxage=${CACHE}, stale-while-revalidate=300`);

  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) {
    return res.status(200).json({ scores: [], scorers: [], teamGoals: [], source: "no_key" });
  }

  try {
    const headers = { "X-Auth-Token": key };
    const [mRes, sRes] = await Promise.all([
      fetch(`${BASE}/matches`, { headers, signal: AbortSignal.timeout(7000) }),
      fetch(`${BASE}/scorers?limit=20`, { headers, signal: AbortSignal.timeout(7000) }),
    ]);

    // 403 here usually means the World Cup isn't on the free tier for this key.
    if (mRes.status === 403 || sRes.status === 403) {
      return res.status(200).json({ scores: [], scorers: [], teamGoals: [], source: "restricted" });
    }

    const mJson = mRes.ok ? await mRes.json() : { matches: [] };
    const sJson = sRes.ok ? await sRes.json() : { scorers: [] };

    const scores = [];
    const teamGoalMap = {};
    for (const m of mJson.matches || []) {
      const ft = m.score && m.score.fullTime;
      if (!ft || ft.home == null || ft.away == null) continue; // not started
      const home = siteCode(m.homeTeam);
      const away = siteCode(m.awayTeam);
      if (!home || !away) continue;
      scores.push({ home, away, hs: ft.home, as: ft.away, status: m.status });
      teamGoalMap[home] = (teamGoalMap[home] || 0) + ft.home;
      teamGoalMap[away] = (teamGoalMap[away] || 0) + ft.away;
    }

    const scorers = (sJson.scorers || [])
      .map((x) => ({
        player: x.player && x.player.name,
        team_code: siteCode(x.team),
        goals: x.goals || 0,
      }))
      .filter((x) => x.player && x.team_code && x.goals > 0)
      .slice(0, 15);

    const teamGoals = Object.entries(teamGoalMap)
      .map(([team_code, goals]) => ({ team_code, goals }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);

    return res.status(200).json({
      scores,
      scorers,
      teamGoals,
      updated: new Date().toISOString(),
      source: scores.length || scorers.length ? "live" : "no_results_yet",
    });
  } catch (e) {
    return res.status(200).json({ scores: [], scorers: [], teamGoals: [], source: "error", error: e.message });
  }
};
