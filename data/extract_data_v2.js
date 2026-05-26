
(async () => {
    const teams_map = {
        "ARG": "Argentina", "AUT": "Austria", "AUS": "Australia", "BEL": "Belgium", "BRA": "Brazil", 
        "CAN": "Canada", "CIV": "Ivory Coast", "COL": "Colombia", "CRC": "Costa Rica", "CRO": "Croatia", 
        "CUW": "Curaçao", "ECU": "Ecuador", "EGY": "Egypt", "ENG": "England", "FRA": "France", 
        "GER": "Germany", "GHA": "Ghana", "HAI": "Haiti", "IRN": "Iran", "JOR": "Jordan", 
        "JPN": "Japan", "KOR": "South Korea", "MAR": "Morocco", "MEX": "Mexico", "NED": "Netherlands", 
        "NZL": "New Zealand", "NGA": "Nigeria", "NOR": "Norway", "PAN": "Panama", "PAR": "Paraguay", 
        "POR": "Portugal", "QAT": "Qatar", "KSA": "Saudi Arabia", "SCO": "Scotland", "SEN": "Senegal", 
        "SRB": "Serbia", "RSA": "South Africa", "ESP": "Spain", "SUI": "Switzerland", "TUN": "Tunisia", 
        "UKR": "Ukraine", "URU": "Uruguay", "USA": "United States", "UZB": "Uzbekistan", "VEN": "Venezuela", 
        "CPV": "Cape Verde", "BOL": "Bolivia", "SUR": "Suriname"
    };

    const reverse_map = {};
    for (let code in teams_map) {
        reverse_map[teams_map[code].toLowerCase()] = code;
    }
    // Add variations
    reverse_map["côte d'ivoire"] = "CIV";
    reverse_map["south korea"] = "KOR";
    reverse_map["republic of korea"] = "KOR";
    reverse_map["usa"] = "USA";
    reverse_map["u.s.a."] = "USA";
    reverse_map["curacao"] = "CUW";

    const results = { squads: {}, coaches: {} };
    const headings = Array.from(document.querySelectorAll('h3'));
    
    headings.forEach(h3 => {
        const headline = h3.querySelector('.mw-headline');
        if (!headline) return;
        const rawName = headline.innerText.trim();
        const lowerName = rawName.toLowerCase();
        let code = "";
        
        // Find code by matching name
        for (let name in reverse_map) {
            if (lowerName.includes(name)) {
                code = reverse_map[name];
                break;
            }
        }
        
        if (code) {
            let coachName = "";
            let coachUrl = "";
            let players = [];
            
            let next = h3.nextElementSibling;
            while (next && next.tagName !== 'H3' && next.tagName !== 'H2') {
                if (next.tagName === 'P' && next.innerText.includes('Coach:')) {
                    const coachLink = next.querySelector('a');
                    coachName = next.innerText.replace('Coach:', '').trim();
                    if (coachLink) {
                        coachUrl = coachLink.href;
                        coachName = coachLink.innerText.trim();
                    }
                }
                if (next.tagName === 'TABLE' && next.classList.contains('wikitable')) {
                    const rows = Array.from(next.querySelectorAll('tr')).slice(1);
                    rows.forEach(row => {
                        const cols = row.querySelectorAll('td, th');
                        if (cols.length >= 7) {
                            const nameLink = cols[2].querySelector('a');
                            const playerName = nameLink ? nameLink.innerText.trim() : cols[2].innerText.trim().replace(/\(captain\)/i, '').trim();
                            const is_captain = cols[2].innerText.includes('(captain)');
                            const pos = cols[1].innerText.trim().split(' ').pop();
                            const club = cols[6].innerText.trim();
                            const number = parseInt(cols[0].innerText.trim()) || 0;
                            const caps = parseInt(cols[4].innerText.trim()) || 0;
                            const goals = parseInt(cols[5].innerText.trim()) || 0;
                            
                            players.push({
                                name: playerName,
                                position: pos,
                                club: club,
                                number: number,
                                is_captain: is_captain,
                                appearances: caps,
                                goals: goals
                            });
                        }
                    });
                }
                next = next.nextElementSibling;
            }
            
            // Selection logic: 1 GK, 4 DF, 3-4 MF, 2-3 FW
            const gk = players.filter(p => p.position === 'GK').slice(0, 1);
            const df = players.filter(p => p.position === 'DF').slice(0, 4);
            const mf = players.filter(p => p.position === 'MF').slice(0, 4);
            const fw = players.filter(p => p.position === 'FW').slice(0, 3);
            
            // Fallback if not enough in positions
            let selected = [...gk, ...df, ...mf, ...fw];
            if (selected.length < 11) {
                const remaining = players.filter(p => !selected.includes(p));
                selected = selected.concat(remaining.slice(0, 11 - selected.length));
            }
            // Max 15
            if (selected.length < 15) {
                const extra = players.filter(p => !selected.includes(p)).slice(0, 15 - selected.length);
                selected = selected.concat(extra);
            }

            results.squads[code] = { key_players: selected };
            results.coaches[code] = { name: coachName, url: coachUrl };
        }
    });
    
    return results;
})();
