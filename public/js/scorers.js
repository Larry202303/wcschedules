/* ============================================
   scorers.js — Top Scorers / Top Teams module
   - Pre-tournament: shows curated "hot" players & teams
   - Once goals exist: replaces with real Top 10 from matches.json
   ============================================ */

(function () {
  const tagToKey = (tag) => `sc_tag_${tag}`;

  // Compute real top scorers from matches (when match-level goal data exists)
  // Each match could carry: scorers: [{ player, team_code, count }]
  function computeRealTopScorers(matches) {
    const playerMap = new Map();
    const teamMap = new Map();
    let hasAny = false;

    matches.forEach((m) => {
      if (Array.isArray(m.scorers) && m.scorers.length) {
        hasAny = true;
        m.scorers.forEach((s) => {
          const pk = `${s.player}__${s.team_code}`;
          playerMap.set(pk, (playerMap.get(pk) || 0) + (s.count || 1));
          teamMap.set(s.team_code, (teamMap.get(s.team_code) || 0) + (s.count || 1));
        });
      }
    });

    if (!hasAny) return null;

    const players = [...playerMap.entries()]
      .map(([k, goals]) => {
        const [player, team_code] = k.split("__");
        return { player, team_code, goals };
      })
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);

    const teams = [...teamMap.entries()]
      .map(([team_code, goals]) => ({ team_code, goals }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);

    return { players, teams };
  }

  function flagFor(code, teams) {
    const t = teams.find((x) => x.code === code);
    return t && t.flag ? t.flag : "🏳️";
  }

  function teamLocalName(code, teams) {
    if (typeof window.teamName === "function") return window.teamName(code);
    const tt = teams.find((x) => x.code === code);
    return (tt && (tt.name_en || tt.name)) || code;
  }

  function renderPreviewPlayers(container, preview, teams) {
    const html = preview.top_players
      .map((p) => {
        const flag = flagFor(p.country_code, teams);
        const tagLabel = window.t(tagToKey(p.tag));
        return `
          <li class="sc-row">
            <span class="sc-rank">${p.rank}</span>
            <span class="sc-flag">${flag}</span>
            <span class="sc-name">
              <strong>${p.name}</strong>
              <span class="sc-meta">${p.club} · ${p.position}</span>
            </span>
            <span class="sc-tag">${tagLabel}</span>
          </li>
        `;
      })
      .join("");
    container.innerHTML = `<ol class="sc-list">${html}</ol>`;
  }

  function renderPreviewTeams(container, preview, teams) {
    const html = preview.top_teams
      .map((t) => {
        const flag = flagFor(t.country_code, teams);
        const name = teamLocalName(t.country_code, teams);
        const tagLabel = window.t(tagToKey(t.tag));
        const slug = typeof window.teamSlug === 'function' ? window.teamSlug(t.country_code) : t.country_code.toLowerCase();
        return `
          <li class="sc-row">
            <span class="sc-rank">${t.rank}</span>
            <span class="sc-flag">${flag}</span>
            <span class="sc-name">
              <a href="/teams/${slug}" style="color:inherit;text-decoration:none"><strong>${name}</strong></a>
            </span>
            <span class="sc-tag">${tagLabel}</span>
          </li>
        `;
      })
      .join("");
    container.innerHTML = `<ol class="sc-list">${html}</ol>`;
  }

  function renderRealPlayers(container, players, teams) {
    const html = players
      .map((p, i) => {
        const flag = flagFor(p.team_code, teams);
        return `
          <li class="sc-row">
            <span class="sc-rank">${i + 1}</span>
            <span class="sc-flag">${flag}</span>
            <span class="sc-name"><strong>${p.player}</strong></span>
            <span class="sc-goals">${p.goals}</span>
          </li>
        `;
      })
      .join("");
    container.innerHTML = `<ol class="sc-list">${html}</ol>`;
  }

  function renderRealTeams(container, list, teams) {
    const html = list
      .map((row, i) => {
        const flag = flagFor(row.team_code, teams);
        const name = teamLocalName(row.team_code, teams);
        const slug = typeof window.teamSlug === 'function' ? window.teamSlug(row.team_code) : row.team_code.toLowerCase();
        return `
          <li class="sc-row">
            <span class="sc-rank">${i + 1}</span>
            <span class="sc-flag">${flag}</span>
            <span class="sc-name"><a href="/teams/${slug}" style="color:inherit;text-decoration:none"><strong>${name}</strong></a></span>
            <span class="sc-goals">${row.goals}</span>
          </li>
        `;
      })
      .join("");
    container.innerHTML = `<ol class="sc-list">${html}</ol>`;
  }

  async function renderScorers(rootSelector, teams, matches) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const playersBody = root.querySelector("[data-sc-body=players]");
    const teamsBody = root.querySelector("[data-sc-body=teams]");
    const previewNote = root.querySelector("[data-sc-note]");

    // Try real first
    const real = computeRealTopScorers(matches);
    if (real) {
      previewNote.style.display = "none";
      renderRealPlayers(playersBody, real.players, teams);
      renderRealTeams(teamsBody, real.teams, teams);
      return;
    }

    // Fall back to preview
    try {
      const res = await fetch("data/scorers_preview.json?v=20260525i");
      const preview = await res.json();
      previewNote.style.display = "";
      renderPreviewPlayers(playersBody, preview, teams);
      renderPreviewTeams(teamsBody, preview, teams);
    } catch (e) {
      console.warn("scorers preview load failed", e);
      previewNote.textContent = "—";
    }
  }

  function bindTabs(rootSelector) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const tabs = root.querySelectorAll("[data-sc-tab]");
    const panels = root.querySelectorAll("[data-sc-panel]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.getAttribute("data-sc-tab");
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        panels.forEach((p) =>
          p.classList.toggle("active", p.getAttribute("data-sc-panel") === target),
        );
      });
    });
  }

  window.initScorers = function (teams, matches) {
    bindTabs("#scorers-section");
    renderScorers("#scorers-section", teams, matches);
  };

  // Re-render on language change so tags + team names update
  document.addEventListener("langchange", () => {
    const root = document.querySelector("#scorers-section");
    if (!root || !window.__scorersData) return;
    const { teams, matches } = window.__scorersData;
    renderScorers("#scorers-section", teams, matches);
  });
})();
