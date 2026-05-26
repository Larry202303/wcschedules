
(() => {
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
    for (let code in teams_map) { reverse_map[teams_map[code].toLowerCase()] = code; }
    reverse_map["côte d'ivoire"] = "CIV";
    reverse_map["south korea"] = "KOR";
    reverse_map["usa"] = "USA";
    reverse_map["curacao"] = "CUW";
    reverse_map["cape verde"] = "CPV";

    const results = { squads: {}, coaches: {} };
    const headings = Array.from(document.querySelectorAll('h3'));
    
    headings.forEach(h3 => {
        const rawName = h3.innerText.trim();
        const lowerName = rawName.toLowerCase();
        let code = "";
        for (let name in reverse_map) { if (lowerName.includes(name)) { code = reverse_map[name]; break; } }
        
        if (code) {
            let coachName = "Unknown";
            let coachUrl = "";
            let players = [];
            let current = h3.parentElement;
            let next = current.nextElementSibling;
            
            while (next && !next.classList.contains('mw-heading')) {
                if (next.tagName === 'P' && (next.innerText.includes('Coach:') || next.innerText.includes('Head coach:'))) {
                    const coachLink = next.querySelector('a');
                    if (coachLink) {
                        coachUrl = coachLink.href;
                        coachName = coachLink.innerText.trim();
                    } else {
                        coachName = next.innerText.split(':')[1].trim();
                    }
                }
                if (next.tagName === 'TABLE') {
                    const rows = Array.from(next.querySelectorAll('tr')).slice(1);
                    rows.forEach(row => {
                        const cols = row.querySelectorAll('td, th');
                        if (cols.length >= 7) {
                            const numStr = cols[0].innerText.trim();
                            const num = parseInt(numStr) || 0;
                            const pos = cols[1].innerText.trim().split(' ').pop();
                            const nameCell = cols[2];
                            const pName = nameCell.innerText.split('(')[0].trim();
                            const is_cap = nameCell.innerText.includes('(captain)');
                            const caps = parseInt(cols[4].innerText) || 0;
                            const goals = parseInt(cols[5].innerText) || 0;
                            const club = cols[6].innerText.trim();
                            players.push({
                                number: num, position: pos, name: pName, is_captain: is_cap, appearances: caps, goals: goals, club: club
                            });
                        }
                    });
                }
                next = next.nextElementSibling;
            }
            if (players.length > 0) {
                const gk = players.filter(p => p.position === 'GK').slice(0, 1);
                const df = players.filter(p => p.position === 'DF').slice(0, 4);
                const mf = players.filter(p => p.position === 'MF').slice(0, 4);
                const fw = players.filter(p => p.position === 'FW').slice(0, 3);
                let selected = [...gk, ...df, ...mf, ...fw];
                if (selected.length < 11) {
                    const remaining = players.filter(p => !selected.includes(p));
                    selected = selected.concat(remaining.slice(0, 11 - selected.length));
                }
                if (selected.length < 15 && players.length > selected.length) {
                    const extra = players.filter(p => !selected.includes(p)).slice(0, 15 - selected.length);
                    selected = selected.concat(extra);
                }
                results.squads[code] = { key_players: selected };
                results.coaches[code] = { name: coachName, url: coachUrl, team: teams_map[code] };
            }
        }
    });
    return results;
})()
