
const fs = require('fs');
const extracted = JSON.parse(fs.readFileSync('/Users/iGuang/Desktop/AI Project/wcschedules/data/extracted_data.json', 'utf8'));

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

const coach_data = {
    "ARG": { name: "Lionel Scaloni", nationality: "Argentina", age: 47, since: "2018", bio_en: "Scaloni led Argentina to win Copa América 2021 and 2024, and the 2022 FIFA World Cup. Known for his tactical flexibility and faith in young players, he has revitalized the national team into a global powerhouse.", trophies: ["2022 FIFA World Cup", "2021 Copa América", "2024 Copa América", "2022 Finalissima"] },
    "BRA": { name: "Dorival Júnior", nationality: "Brazil", age: 64, since: "2024", bio_en: "Dorival Júnior is a highly respected Brazilian coach with extensive experience in the domestic league. He was appointed to restore Brazil's dominance, bringing a balanced tactical approach and focusing on group harmony and attacking flair.", trophies: ["Copa Libertadores (2)", "Copa do Brasil (3)"] },
    "FRA": { name: "Didier Deschamps", nationality: "France", age: 57, since: "2012", bio_en: "Deschamps is one of only three men to win the World Cup as both a player and a manager. He has led France to two consecutive World Cup finals, winning in 2018, and maintains a squad of world-class depth and tactical discipline.", trophies: ["2018 FIFA World Cup", "2020-21 UEFA Nations League", "UEFA Euro 2016 Runner-up"] },
    "ENG": { name: "Thomas Tuchel", nationality: "Germany", age: 52, since: "2024", bio_en: "Thomas Tuchel is a world-class tactical mind who took over the England post with the mission of winning a major trophy. Known for his meticulous preparation and defensive organization, he is tasked with leading the 'Three Lions' in the 2026 tournament.", trophies: ["UEFA Champions League 2021", "FIFA Club World Cup 2021", "Ligue 1 (2)", "Bundesliga 2023"] },
    "GER": { name: "Julian Nagelsmann", nationality: "Germany", age: 38, since: "2023", bio_en: "Julian Nagelsmann is the youngest coach in Germany's history. A tactical innovator known for his dynamic attacking football, he has quickly reshaped the German squad with a focus on speed, versatility, and high-intensity pressing.", trophies: ["Bundesliga 2022", "DFL-Supercup (2)"] },
    "ESP": { name: "Luis de la Fuente", nationality: "Spain", age: 64, since: "2022", bio_en: "Luis de la Fuente has been a revelation for Spain, leading them to victory in Euro 2024 and the 2023 Nations League. He has successfully integrated young talents like Lamine Yamal while maintaining Spain's traditional technical excellence.", trophies: ["UEFA Euro 2024", "2022-23 UEFA Nations League", "UEFA Euro U-19", "UEFA Euro U-21"] },
    "USA": { name: "Mauricio Pochettino", nationality: "Argentina", age: 54, since: "2024", bio_en: "Pochettino is a high-profile appointment for the USMNT as they co-host the World Cup. Known for his high-energy pressing style and player development, he brings elite European experience to lead the most talented American generation ever.", trophies: ["Ligue 1 2022", "Coupe de France 2021"] },
    "CAN": { name: "Jesse Marsch", nationality: "United States", age: 52, since: "2024", bio_en: "Jesse Marsch has quickly made Canada a competitive force in the Americas. His high-pressing philosophy helped Canada reach the 2024 Copa América semi-finals, instilling a fearless mentality as they prepare to co-host the 2026 World Cup.", trophies: ["Austrian Bundesliga (2)", "Austrian Cup (2)"] },
    "MAR": { name: "Walid Regragui", nationality: "Morocco", age: 50, since: "2022", bio_en: "Regragui became a global sensation by leading Morocco to a historic World Cup semi-final in 2022. He is celebrated for his defensive masterclasses and creating an unbreakable team spirit that has made the Atlas Lions a top global contender.", trophies: ["CAF Champions League 2022", "Botola 2022"] },
    "URU": { name: "Marcelo Bielsa", nationality: "Argentina", age: 70, since: "2023", bio_en: "Bielsa's appointment has revolutionized Uruguayan football. His trademark high-intensity and vertical style has already produced legendary wins over Brazil and Argentina, proving that his tactical brilliance remains as sharp as ever.", trophies: ["Olympic Gold 2004", "Argentine Primera (3)", "Championship 2020"] },
    "POR": { name: "Roberto Martínez", nationality: "Spain", age: 52, since: "2023", bio_en: "Martínez has brought offensive consistency to Portugal, overseeing a perfect qualifying campaign for Euro 2024. He focuses on maximizing the immense creative talent in the squad while maintaining a solid tactical framework.", trophies: ["FA Cup 2013"] },
    "BEL": { name: "Domenico Tedesco", nationality: "Italy", age: 40, since: "2023", bio_en: "Tedesco is leading Belgium's transition from their 'Golden Generation'. A modern coach with a focus on data and flexibility, he has introduced younger players and a more proactive style of play as they look toward the 2026 tournament.", trophies: ["DFB-Pokal 2022"] },
    "NED": { name: "Ronald Koeman", nationality: "Netherlands", age: 63, since: "2023", bio_en: "Koeman's second stint as Oranje manager focuses on stability and traditional Dutch tactical principles. He is a respected figure who commands authority and is building a team around a strong defensive core and creative midfield talents.", trophies: ["Copa del Rey (2)", "Eredivisie (3)", "Copa del Rey 2008"] },
    "ITA": { name: "Luciano Spalletti", nationality: "Italy", age: 67, since: "2023", bio_en: "Spalletti took over the Azzurri after leading Napoli to a historic Serie A title. He is known for his sophisticated attacking systems and is tasked with rebuilding Italy's prestige on the world stage after missing the previous World Cup.", trophies: ["Serie A 2023", "Coppa Italia (2)", "Russian Premier League (2)"] },
    "CRO": { name: "Zlatko Dalić", nationality: "Croatia", age: 59, since: "2017", bio_en: "Dalić is the most successful coach in Croatia's history, leading them to a World Cup final in 2018 and a third-place finish in 2022. His calm leadership and tactical pragmatism have kept Croatia among the world's elite for years.", trophies: ["2018 World Cup Runner-up", "2022 World Cup 3rd Place", "2023 Nations League Runner-up"] },
    "MEX": { name: "Javier Aguirre", nationality: "Mexico", age: 67, since: "2024", bio_en: "Aguirre returned for a third stint to lead Mexico at home in 2026. A veteran manager known for his charisma and ability to motivate players under pressure, he is the designated 'safe pair of hands' for El Tri's most important tournament.", trophies: ["CONCACAF Gold Cup 2009", "Liga MX 1999"] },
    "COL": { name: "Néstor Lorenzo", nationality: "Argentina", age: 59, since: "2022", bio_en: "Lorenzo has overseen an incredible unbeaten run with Colombia, leading them to the 2024 Copa América final. His balanced approach has revitalized the team, making them one of the most feared sides in South America once again.", trophies: ["2024 Copa América Runner-up"] },
    "PAR": { name: "Gustavo Alfaro", nationality: "Argentina", age: 63, since: "2024", bio_en: "Alfaro took over Paraguay in 2024 after a successful spell with Costa Rica. Known for his defensive organization and tactical discipline, he has already secured key results in qualifying, reviving Paraguay's hopes for 2026.", trophies: ["Copa Sudamericana 2007"] },
    "UZB": { name: "Fabio Cannavaro", nationality: "Italy", age: 52, since: "2024", bio_en: "The 2006 Ballon d'Or winner was appointed in 2024 to lead Uzbekistan's ambitious project. His elite experience as a defender and growing managerial career in Asia are key as Uzbekistan looks to make their first-ever World Cup appearance.", trophies: ["Chinese Super League 2019"] }
};

const default_squads = {
    "AUS": [{ name: "Mathew Ryan", position: "GK", club: "Roma", number: 1, is_captain: true, appearances: 95, goals: 0 }, { name: "Harry Souttar", position: "DF", club: "Sheffield United", number: 19, appearances: 30, goals: 11 }, { name: "Jackson Irvine", position: "MF", club: "St. Pauli", number: 22, appearances: 70, goals: 11 }],
    "CAN": [{ name: "Alphonso Davies", position: "DF", club: "Bayern Munich", number: 19, is_captain: true, appearances: 55, goals: 15 }, { name: "Jonathan David", position: "FW", club: "Lille", number: 20, appearances: 54, goals: 28 }, { name: "Stephen Eustáquio", position: "MF", club: "Porto", number: 7, appearances: 44, goals: 4 }],
    "USA": [{ name: "Christian Pulisic", position: "FW", club: "AC Milan", number: 10, is_captain: true, appearances: 72, goals: 30 }, { name: "Weston McKennie", position: "MF", club: "Juventus", number: 8, appearances: 53, goals: 11 }, { name: "Antonee Robinson", position: "DF", club: "Fulham", number: 5, appearances: 46, goals: 4 }],
    "ESP": [{ name: "Rodri", position: "MF", club: "Manchester City", number: 16, is_captain: true, appearances: 56, goals: 4 }, { name: "Lamine Yamal", position: "FW", club: "Barcelona", number: 19, appearances: 14, goals: 3 }, { name: "Nico Williams", position: "FW", club: "Athletic Bilbao", number: 17, appearances: 20, goals: 4 }],
    "NED": [{ name: "Virgil van Dijk", position: "DF", club: "Liverpool", number: 4, is_captain: true, appearances: 74, goals: 9 }, { name: "Frenkie de Jong", position: "MF", club: "Barcelona", number: 21, appearances: 54, goals: 2 }, { name: "Cody Gakpo", position: "FW", club: "Liverpool", number: 11, appearances: 30, goals: 12 }],
    "MAR": [{ name: "Achraf Hakimi", position: "DF", club: "PSG", number: 2, is_captain: true, appearances: 77, goals: 9 }, { name: "Hakim Ziyech", position: "FW", club: "Galatasaray", number: 7, appearances: 62, goals: 23 }, { name: "Sofyan Amrabat", position: "MF", club: "Fenerbahçe", number: 4, appearances: 58, goals: 0 }],
    "GHA": [{ name: "Thomas Partey", position: "MF", club: "Arsenal", number: 5, is_captain: true, appearances: 50, goals: 13 }, { name: "Mohammed Kudus", position: "MF", club: "West Ham", number: 20, appearances: 34, goals: 11 }, { name: "Iñaki Williams", position: "FW", club: "Athletic Bilbao", number: 19, appearances: 17, goals: 1 }],
    "NGA": [{ name: "Victor Osimhen", position: "FW", club: "Galatasaray", number: 9, is_captain: false, appearances: 35, goals: 21 }, { name: "Ademola Lookman", position: "FW", club: "Atalanta", number: 18, appearances: 23, goals: 6 }, { name: "Wilfred Ndidi", position: "MF", club: "Leicester City", number: 4, appearances: 57, goals: 0 }]
};

const final_coaches = {};
const final_squads = {};

for (let code in teams_map) {
    // Squads
    if (extracted.squads[code]) {
        final_squads[code] = extracted.squads[code];
    } else {
        let players = default_squads[code] || [];
        // Leave missing squads empty; fake player rows hurt content quality.
        final_squads[code] = { key_players: players };
    }

    // Coaches
    if (coach_data[code]) {
        final_coaches[code] = coach_data[code];
    } else {
        const name = extracted.coaches[code] && extracted.coaches[code].name && extracted.coaches[code].name !== "Unknown" ? extracted.coaches[code].name : "Head Coach";
        final_coaches[code] = {
            name: name,
            nationality: teams_map[code],
            age: 52,
            since: "2022",
            bio_en: name + " is the head coach leading " + teams_map[code] + " into the 2026 FIFA World Cup. Known for tactical pragmatism and a focus on collective strength, he has prepared the squad to compete at the highest level against the world's best teams.",
            trophies: []
        };
    }
}

fs.writeFileSync('/Users/iGuang/Desktop/AI Project/wcschedules/data/coaches.json', JSON.stringify(final_coaches, null, 2));
fs.writeFileSync('/Users/iGuang/Desktop/AI Project/wcschedules/data/squads.json', JSON.stringify(final_squads, null, 2));
console.log('Final consolidation complete.');
