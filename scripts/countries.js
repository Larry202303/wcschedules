'use strict';
/*
 * Master country dataset for the per-country "Schedule by Country Time" and
 * "Where to Watch" pages. Union of: top-30 most populous countries + all of
 * Europe + all of the Middle East.
 *
 * Each entry:
 *   name      English display name
 *   slug      URL slug for the /watch/<slug>/ page
 *   region    'eu' | 'mena' | 'world'  (drives the broadcaster fallback)
 *   bc        broadcasters [[name, 'free'|'paid', note], ...]  (optional; a
 *             region default is used when omitted)
 *   tz        timezone page(s): [[slug, label, IANA, abbr], ...]
 *             Multi-timezone countries list several entries.
 *
 * Timezone abbreviations are for the tournament window (Jun–Jul 2026, DST live).
 */

// shared broadcaster shorthands
const beIN = [['beIN Sports', 'paid', '']];
const euPublic = (tv) => [[tv, 'free', 'free-to-air']];

const COUNTRIES = [
  // ── Hosts / major non-EU/ME markets ──────────────────────────────────────
  { name: 'the United States', slug: 'united-states', region: 'world', bc: [['FOX & FS1', 'paid', 'English'], ['Telemundo / Peacock', 'paid', 'Spanish']],
    tz: [['us-eastern-time', 'US Eastern Time', 'America/New_York', 'EDT'], ['us-central-time', 'US Central Time', 'America/Chicago', 'CDT'], ['us-mountain-time', 'US Mountain Time', 'America/Denver', 'MDT'], ['us-pacific-time', 'US Pacific Time', 'America/Los_Angeles', 'PDT']] },
  { name: 'Mexico', slug: 'mexico', region: 'world', bc: [['Canal 5 / Televisa', 'free', ''], ['TUDN', 'paid', ''], ['TV Azteca', 'free', '']],
    tz: [['mexico-time', 'Mexico City Time', 'America/Mexico_City', 'CST'], ['mexico-pacific-time', 'Mexico Pacific Time', 'America/Tijuana', 'PDT']] },
  { name: 'Brazil', slug: 'brazil', region: 'world', bc: [['TV Globo', 'free', ''], ['SporTV', 'paid', ''], ['CazéTV (YouTube)', 'free', '']],
    tz: [['brazil-time', 'Brazil (Brasília) Time', 'America/Sao_Paulo', 'BRT'], ['brazil-amazon-time', 'Brazil (Amazonas) Time', 'America/Manaus', 'AMT']] },
  { name: 'India', slug: 'india', region: 'world', bc: [['Sports18', 'paid', 'TV'], ['JioHotstar', 'paid', 'streaming']],
    tz: [['india-time', 'India Time', 'Asia/Kolkata', 'IST']] },
  { name: 'China', slug: 'china', region: 'world', bc: [['CCTV-5', 'free', ''], ['Migu', 'paid', 'streaming']],
    tz: [['china-time', 'China Time', 'Asia/Shanghai', 'CST']] },
  { name: 'Indonesia', slug: 'indonesia', region: 'world', tz: [['indonesia-west-time', 'Indonesia Western (WIB) Time', 'Asia/Jakarta', 'WIB'], ['indonesia-central-time', 'Indonesia Central (WITA) Time', 'Asia/Makassar', 'WITA'], ['indonesia-east-time', 'Indonesia Eastern (WIT) Time', 'Asia/Jayapura', 'WIT']] },
  { name: 'Pakistan', slug: 'pakistan', region: 'world', bc: [['PTV Sports', 'paid', ''], ['ARY Sports', 'paid', '']], tz: [['pakistan-time', 'Pakistan Time', 'Asia/Karachi', 'PKT']] },
  { name: 'Nigeria', slug: 'nigeria', region: 'world', bc: [['SuperSport (DStv)', 'paid', ''], ['NTA', 'free', 'selected']], tz: [['nigeria-time', 'Nigeria Time', 'Africa/Lagos', 'WAT']] },
  { name: 'Bangladesh', slug: 'bangladesh', region: 'world', tz: [['bangladesh-time', 'Bangladesh Time', 'Asia/Dhaka', 'BST']] },
  { name: 'Russia', slug: 'russia', region: 'world', tz: [['russia-moscow-time', 'Russia (Moscow) Time', 'Europe/Moscow', 'MSK'], ['russia-yekaterinburg-time', 'Russia (Yekaterinburg) Time', 'Asia/Yekaterinburg', '+05'], ['russia-vladivostok-time', 'Russia (Vladivostok) Time', 'Asia/Vladivostok', '+10']] },
  { name: 'Ethiopia', slug: 'ethiopia', region: 'world', tz: [['ethiopia-time', 'Ethiopia Time', 'Africa/Addis_Ababa', 'EAT']] },
  { name: 'Japan', slug: 'japan', region: 'world', bc: [['NHK', 'free', ''], ['ABEMA', 'free', 'streaming']], tz: [['japan-time', 'Japan Time', 'Asia/Tokyo', 'JST']] },
  { name: 'the Philippines', slug: 'philippines', region: 'world', tz: [['philippines-time', 'Philippines Time', 'Asia/Manila', 'PHT']] },
  { name: 'DR Congo', slug: 'dr-congo', region: 'world', tz: [['dr-congo-west-time', 'DR Congo (Kinshasa) Time', 'Africa/Kinshasa', 'WAT'], ['dr-congo-east-time', 'DR Congo (Lubumbashi) Time', 'Africa/Lubumbashi', 'CAT']] },
  { name: 'Vietnam', slug: 'vietnam', region: 'world', tz: [['vietnam-time', 'Vietnam Time', 'Asia/Ho_Chi_Minh', 'ICT']] },
  { name: 'Thailand', slug: 'thailand', region: 'world', tz: [['thailand-time', 'Thailand Time', 'Asia/Bangkok', 'ICT']] },
  { name: 'Tanzania', slug: 'tanzania', region: 'world', tz: [['tanzania-time', 'Tanzania Time', 'Africa/Dar_es_Salaam', 'EAT']] },
  { name: 'South Africa', slug: 'south-africa', region: 'world', bc: [['SuperSport (DStv)', 'paid', ''], ['SABC', 'free', 'selected']], tz: [['south-africa-time', 'South Africa Time', 'Africa/Johannesburg', 'SAST']] },
  { name: 'Kenya', slug: 'kenya', region: 'world', tz: [['kenya-time', 'Kenya Time', 'Africa/Nairobi', 'EAT']] },
  { name: 'Myanmar', slug: 'myanmar', region: 'world', tz: [['myanmar-time', 'Myanmar Time', 'Asia/Yangon', 'MMT']] },
  { name: 'Colombia', slug: 'colombia', region: 'world', tz: [['colombia-time', 'Colombia Time', 'America/Bogota', 'COT']] },
  { name: 'South Korea', slug: 'south-korea', region: 'world', bc: [['KBS / MBC / SBS', 'free', ''], ['Coupang Play', 'paid', 'streaming']], tz: [['south-korea-time', 'South Korea Time', 'Asia/Seoul', 'KST']] },
  { name: 'Uganda', slug: 'uganda', region: 'world', tz: [['uganda-time', 'Uganda Time', 'Africa/Kampala', 'EAT']] },
  { name: 'Canada', slug: 'canada', region: 'world', bc: [['CTV', 'free', 'partly'], ['TSN', 'paid', ''], ['RDS', 'paid', 'French']], tz: [['canada-eastern-time', 'Canada Eastern Time', 'America/Toronto', 'EDT'], ['canada-pacific-time', 'Canada Pacific Time', 'America/Vancouver', 'PDT']] },
  { name: 'Australia', slug: 'australia', region: 'world', bc: [['SBS', 'free', ''], ['Optus Sport', 'paid', '']], tz: [['australia-time', 'Australia (Sydney) Time', 'Australia/Sydney', 'AEST']] },

  // ── Europe (top 15 by population; Russia/Germany/UK/France/Italy are counted
  //    among the top-30 world list above) ─────────────────────────────────────
  { name: 'the United Kingdom', slug: 'united-kingdom', region: 'eu', bc: [['BBC (iPlayer)', 'free', ''], ['ITV (ITVX)', 'free', '']], tz: [['uk-time', 'UK Time', 'Europe/London', 'BST']] },
  { name: 'France', slug: 'france', region: 'eu', bc: [['TF1', 'free', ''], ['beIN Sports', 'paid', '']], tz: [['france-time', 'France Time', 'Europe/Paris', 'CEST']] },
  { name: 'Germany', slug: 'germany', region: 'eu', bc: [['ARD & ZDF', 'free', ''], ['MagentaTV', 'paid', '']], tz: [['germany-time', 'Germany Time', 'Europe/Berlin', 'CEST']] },
  { name: 'Italy', slug: 'italy', region: 'eu', bc: [['RAI', 'free', '']], tz: [['italy-time', 'Italy Time', 'Europe/Rome', 'CEST']] },
  { name: 'Spain', slug: 'spain', region: 'eu', bc: euPublic('RTVE'), tz: [['spain-time', 'Spain Time', 'Europe/Madrid', 'CEST']] },
  { name: 'Poland', slug: 'poland', region: 'eu', tz: [['poland-time', 'Poland Time', 'Europe/Warsaw', 'CEST']] },
  { name: 'Ukraine', slug: 'ukraine', region: 'eu', tz: [['ukraine-time', 'Ukraine Time', 'Europe/Kyiv', 'EEST']] },
  { name: 'Romania', slug: 'romania', region: 'eu', tz: [['romania-time', 'Romania Time', 'Europe/Bucharest', 'EEST']] },
  { name: 'the Netherlands', slug: 'netherlands', region: 'eu', bc: euPublic('NOS'), tz: [['netherlands-time', 'Netherlands Time', 'Europe/Amsterdam', 'CEST']] },
  { name: 'Belgium', slug: 'belgium', region: 'eu', tz: [['belgium-time', 'Belgium Time', 'Europe/Brussels', 'CEST']] },
  { name: 'Czechia', slug: 'czechia', region: 'eu', tz: [['czechia-time', 'Czechia Time', 'Europe/Prague', 'CEST']] },
  { name: 'Sweden', slug: 'sweden', region: 'eu', tz: [['sweden-time', 'Sweden Time', 'Europe/Stockholm', 'CEST']] },
  { name: 'Portugal', slug: 'portugal', region: 'eu', bc: euPublic('RTP'), tz: [['portugal-time', 'Portugal Time', 'Europe/Lisbon', 'WEST']] },
  { name: 'Greece', slug: 'greece', region: 'eu', tz: [['greece-time', 'Greece Time', 'Europe/Athens', 'EEST']] },

  // ── Middle East ─────────────────────────────────────────────────────────
  { name: 'Turkey', slug: 'turkey', region: 'mena', bc: [['TRT', 'free', '']], tz: [['turkey-time', 'Turkey Time', 'Europe/Istanbul', '+03']] },
  { name: 'Saudi Arabia', slug: 'saudi-arabia', region: 'mena', bc: [['Saudi Sports / SSC', 'paid', ''], ['beIN Sports', 'paid', '']], tz: [['saudi-arabia-time', 'Saudi Arabia Time', 'Asia/Riyadh', 'AST']] },
  { name: 'Iran', slug: 'iran', region: 'mena', bc: [['IRIB', 'free', '']], tz: [['iran-time', 'Iran Time', 'Asia/Tehran', '+0330']] },
  { name: 'Iraq', slug: 'iraq', region: 'mena', tz: [['iraq-time', 'Iraq Time', 'Asia/Baghdad', 'AST']] },
  { name: 'Egypt', slug: 'egypt', region: 'mena', bc: beIN, tz: [['egypt-time', 'Egypt Time', 'Africa/Cairo', 'EEST']] },
  { name: 'the United Arab Emirates', slug: 'united-arab-emirates', region: 'mena', bc: beIN, tz: [['uae-time', 'UAE Time', 'Asia/Dubai', 'GST']] },
  { name: 'Israel', slug: 'israel', region: 'mena', tz: [['israel-time', 'Israel Time', 'Asia/Jerusalem', 'IDT']] },
  { name: 'Jordan', slug: 'jordan', region: 'mena', tz: [['jordan-time', 'Jordan Time', 'Asia/Amman', '+03']] },
  { name: 'Lebanon', slug: 'lebanon', region: 'mena', tz: [['lebanon-time', 'Lebanon Time', 'Asia/Beirut', 'EEST']] },
  { name: 'Palestine', slug: 'palestine', region: 'mena', tz: [['palestine-time', 'Palestine Time', 'Asia/Hebron', 'EEST']] },
  { name: 'Syria', slug: 'syria', region: 'mena', tz: [['syria-time', 'Syria Time', 'Asia/Damascus', '+03']] },
  { name: 'Yemen', slug: 'yemen', region: 'mena', tz: [['yemen-time', 'Yemen Time', 'Asia/Aden', 'AST']] },
  { name: 'Oman', slug: 'oman', region: 'mena', tz: [['oman-time', 'Oman Time', 'Asia/Muscat', 'GST']] },
  { name: 'Kuwait', slug: 'kuwait', region: 'mena', tz: [['kuwait-time', 'Kuwait Time', 'Asia/Kuwait', 'AST']] },
  { name: 'Qatar', slug: 'qatar', region: 'mena', bc: beIN, tz: [['qatar-time', 'Qatar Time', 'Asia/Qatar', 'AST']] },
  { name: 'Bahrain', slug: 'bahrain', region: 'mena', tz: [['bahrain-time', 'Bahrain Time', 'Asia/Bahrain', 'AST']] },
];

// Broadcaster fallback by region (used when a country has no explicit bc list).
const REGION_DEFAULT_BC = {
  eu: [['National public broadcaster', 'free', 'most EU countries show World Cup matches free-to-air'], ['Sky / paid sports channels', 'paid', '']],
  mena: [['beIN Sports', 'paid', 'regional rights holder'], ['Saudi SSC', 'paid', '']],
  world: [['Local rights holder', 'paid', 'check national listings']],
};

module.exports = { COUNTRIES, REGION_DEFAULT_BC };
