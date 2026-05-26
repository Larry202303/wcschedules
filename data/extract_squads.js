
(async () => {
    const teams = {};
    const teamHeaders = Array.from(document.querySelectorAll('h3 .mw-headline'));
    
    for (const header of teamHeaders) {
        const teamName = header.innerText.trim();
        const section = header.parentElement;
        let coach = "";
        let playerTable = null;
        
        let next = section.nextElementSibling;
        while (next && next.tagName !== 'H3') {
            if (next.tagName === 'P' && next.innerText.includes('Coach:')) {
                coach = next.innerText.replace('Coach:', '').trim();
            }
            if (next.tagName === 'TABLE' && next.classList.contains('wikitable')) {
                playerTable = next;
            }
            next = next.nextElementSibling;
        }
        
        if (playerTable) {
            const players = [];
            const rows = Array.from(playerTable.querySelectorAll('tr')).slice(1);
            for (const row of rows) {
                const cols = row.querySelectorAll('td, th');
                if (cols.length >= 7) {
                    const number = parseInt(cols[0].innerText.trim()) || 0;
                    const pos = cols[1].innerText.trim();
                    const name = cols[2].innerText.trim().replace(/\(captain\)/i, '').trim();
                    const is_captain = cols[2].innerText.includes('(captain)');
                    const dob_age = cols[3].innerText.trim();
                    const caps = parseInt(cols[4].innerText.trim()) || 0;
                    const goals = parseInt(cols[5].innerText.trim()) || 0;
                    const club = cols[6].innerText.trim();
                    
                    players.push({
                        number,
                        position: pos.split(' ').pop(), // GK, DF, MF, FW
                        name,
                        is_captain,
                        caps,
                        goals,
                        club
                    });
                }
            }
            teams[teamName] = {
                coach,
                players
            };
        }
    }
    return teams;
})();
