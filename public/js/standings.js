/* ============================================
   Standings calculator (shared by app.js + group.js)
   Computes group standings from matches.json.
   Pre-tournament: matches have no scores → fake deterministic
   "preview ranking" so each group still shows a sensible order.
   ============================================ */

(function () {
  // Simple deterministic hash → 0..1 (xfnv1a + sfc32 stub)
  function hashCodeToFloat(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // mix
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17; h >>>= 0;
    h ^= h << 5;  h >>>= 0;
    return (h >>> 0) / 4294967296;
  }

  // Pre-tournament row: all zeros, but each team gets a deterministic
  // "sort key" derived from its code hash so the displayed order is
  // shuffled (not alphabetical) yet stable across reloads.
  function fakePreviewRow(team) {
    return {
      code: team.code,
      played: 0,
      win: 0, draw: 0, loss: 0,
      gf: 0, ga: 0, gd: 0,
      points: 0,
      preview: true,
      _sortKey: hashCodeToFloat(team.code + "-2026"),
    };
  }

  // Compute real standings from matches with results (home_score/away_score not null)
  function realRow(team) {
    return {
      code: team.code,
      played: 0,
      win: 0, draw: 0, loss: 0,
      gf: 0, ga: 0, gd: 0,
      points: 0,
      preview: false,
    };
  }

  // Real-match sort: points desc → GD desc → GF desc → code asc
  function compareRows(a, b) {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return (a.code || "").localeCompare(b.code || "");
  }
  // Preview sort: by deterministic shuffled hash → looks random but stable
  function comparePreview(a, b) {
    return a._sortKey - b._sortKey;
  }

  /**
   * computeGroupStandings(teams, matches, groupKey)
   * @param {Array} teams - DATA.teams
   * @param {Array} matches - DATA.matches
   * @param {String} groupKey - "A".."L"
   * @returns sorted array of standings rows
   */
  function computeGroupStandings(teams, matches, groupKey) {
    const G = (groupKey || "").toUpperCase();
    const groupTeams = teams.filter((t) => (t.group || "").toUpperCase() === G);
    if (groupTeams.length === 0) return [];

    const groupMatches = matches.filter((m) => (m.group || "").toUpperCase() === G);
    const hasAnyResult = groupMatches.some(
      (m) => m.home_score != null && m.away_score != null
    );

    if (!hasAnyResult) {
      // Pre-tournament: all 0 points, order shuffled deterministically.
      return groupTeams.map(fakePreviewRow).sort(comparePreview);
    }

    // Real standings
    const map = {};
    groupTeams.forEach((tm) => { map[tm.code] = realRow(tm); });

    for (const m of groupMatches) {
      const hs = m.home_score;
      const as = m.away_score;
      if (hs == null || as == null) continue;
      const H = map[m.home_code];
      const A = map[m.away_code];
      if (!H || !A) continue;
      H.played++; A.played++;
      H.gf += hs; H.ga += as;
      A.gf += as; A.ga += hs;
      H.gd = H.gf - H.ga;
      A.gd = A.gf - A.ga;
      if (hs > as) { H.win++; H.points += 3; A.loss++; }
      else if (hs < as) { A.win++; A.points += 3; H.loss++; }
      else { H.draw++; A.draw++; H.points += 1; A.points += 1; }
    }

    return Object.values(map).sort(compareRows);
  }

  // expose globally
  window.computeGroupStandings = computeGroupStandings;
})();
