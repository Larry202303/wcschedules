/* ============================================
   Timezone helpers — shared by app.js and match.js
   Loaded BEFORE app.js / match.js
   ============================================ */

window.STORAGE_TZ = "wc_tz";

// Common timezone list (label, IANA tz). "auto" = use system.
window.TIMEZONE_LIST = [
  { id: "auto",                    label: "Auto (system)" },

  // ── UTC ──────────────────────────────────────────────
  { id: "UTC",                     label: "UTC+0  — UTC" },

  // ── Americas ─────────────────────────────────────────
  { id: "Pacific/Honolulu",        label: "UTC-10 — Hawaii (Honolulu)" },
  { id: "America/Anchorage",       label: "UTC-9  — Alaska (Anchorage)" },
  { id: "America/Los_Angeles",     label: "UTC-8  — Los Angeles / Vancouver" },
  { id: "America/Denver",          label: "UTC-7  — Denver / Phoenix" },
  { id: "America/Chicago",         label: "UTC-6  — Chicago / Mexico City" },
  { id: "America/Mexico_City",     label: "UTC-6  — Mexico City" },
  { id: "America/New_York",        label: "UTC-5  — New York / Toronto / Miami" },
  { id: "America/Toronto",         label: "UTC-5  — Toronto" },
  { id: "America/Bogota",          label: "UTC-5  — Bogotá / Lima / Quito" },
  { id: "America/Caracas",         label: "UTC-4  — Caracas" },
  { id: "America/Santiago",        label: "UTC-4  — Santiago" },
  { id: "America/Sao_Paulo",       label: "UTC-3  — São Paulo / Brasília" },
  { id: "America/Argentina/Buenos_Aires", label: "UTC-3  — Buenos Aires" },

  // ── Europe ───────────────────────────────────────────
  { id: "Europe/London",           label: "UTC+1  — London / Dublin / Lisbon" },
  { id: "Europe/Paris",            label: "UTC+2  — Paris / Amsterdam / Rome" },
  { id: "Europe/Berlin",           label: "UTC+2  — Berlin / Warsaw / Vienna" },
  { id: "Europe/Madrid",           label: "UTC+2  — Madrid / Barcelona" },
  { id: "Europe/Rome",             label: "UTC+2  — Rome / Milan" },
  { id: "Europe/Istanbul",         label: "UTC+3  — Istanbul / Ankara" },
  { id: "Europe/Moscow",           label: "UTC+3  — Moscow / St. Petersburg" },
  { id: "Europe/Kiev",             label: "UTC+3  — Kyiv / Helsinki / Bucharest" },

  // ── Africa / Middle East ─────────────────────────────
  { id: "Africa/Casablanca",       label: "UTC+1  — Casablanca / Rabat" },
  { id: "Africa/Cairo",            label: "UTC+3  — Cairo / Nairobi" },
  { id: "Asia/Riyadh",             label: "UTC+3  — Riyadh / Kuwait / Baghdad" },
  { id: "Asia/Tehran",             label: "UTC+3:30 — Tehran" },
  { id: "Asia/Dubai",              label: "UTC+4  — Dubai / Abu Dhabi / Baku" },
  { id: "Asia/Kabul",              label: "UTC+4:30 — Kabul" },

  // ── Asia ─────────────────────────────────────────────
  { id: "Asia/Karachi",            label: "UTC+5  — Karachi / Islamabad" },
  { id: "Asia/Kolkata",            label: "UTC+5:30 — Mumbai / Delhi / Kolkata" },
  { id: "Asia/Dhaka",              label: "UTC+6  — Dhaka / Almaty" },
  { id: "Asia/Yangon",             label: "UTC+6:30 — Yangon (Rangoon)" },
  { id: "Asia/Bangkok",            label: "UTC+7  — Bangkok / Hanoi / Jakarta" },
  { id: "Asia/Ho_Chi_Minh",        label: "UTC+7  — Ho Chi Minh City / Hanoi" },
  { id: "Asia/Jakarta",            label: "UTC+7  — Jakarta / Sumatra" },
  { id: "Asia/Kuala_Lumpur",       label: "UTC+8  — Kuala Lumpur / Singapore" },
  { id: "Asia/Singapore",          label: "UTC+8  — Singapore" },
  { id: "Asia/Hong_Kong",          label: "UTC+8  — Hong Kong / Taipei" },
  { id: "Asia/Shanghai",           label: "UTC+8  — Beijing / Shanghai / Chengdu" },
  { id: "Asia/Ulaanbaatar",        label: "UTC+8  — Ulaanbaatar" },
  { id: "Asia/Tokyo",              label: "UTC+9  — Tokyo / Osaka / Seoul" },
  { id: "Asia/Seoul",              label: "UTC+9  — Seoul / Pyongyang" },

  // ── Oceania ──────────────────────────────────────────
  { id: "Australia/Perth",         label: "UTC+8  — Perth" },
  { id: "Australia/Darwin",        label: "UTC+9:30 — Darwin" },
  { id: "Australia/Adelaide",      label: "UTC+9:30 — Adelaide" },
  { id: "Australia/Brisbane",      label: "UTC+10 — Brisbane" },
  { id: "Australia/Sydney",        label: "UTC+11 — Sydney / Melbourne" },
  { id: "Pacific/Auckland",        label: "UTC+12 — Auckland / Wellington" },
  { id: "Pacific/Fiji",            label: "UTC+12 — Fiji" },
];

window.getSystemTz = function () {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

// Resolve stored value (handles "auto")
window.resolveTz = function (storedValue) {
  if (!storedValue || storedValue === "auto") return window.getSystemTz();
  return storedValue;
};

// Get current preference (raw, from localStorage; defaults to "auto")
window.getStoredTz = function () {
  try {
    return localStorage.getItem(window.STORAGE_TZ) || "auto";
  } catch {
    return "auto";
  }
};

window.setStoredTz = function (value) {
  try { localStorage.setItem(window.STORAGE_TZ, value); } catch {}
};

// Get timezone abbreviation (e.g. "PDT", "CST") for a given timezone + date
window.tzAbbrev = function (date, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart ? tzPart.value : tz;
  } catch {
    return tz;
  }
};

// Format date in given timezone, with abbreviation appended
// opts: { withDate (bool), withWeekday (bool), withYear (bool) }
window.formatInTz = function (date, tz, lang, opts) {
  opts = opts || {};
  const localeMap = {
    "zh-CN": "zh-CN", "zh-TW": "zh-TW", en: "en-US", es: "es-ES",
    pt: "pt-BR", ja: "ja-JP", ko: "ko-KR", ru: "ru-RU",
    ar: "ar-SA", id: "id-ID", fr: "fr-FR",
    th: "th-TH", vi: "vi-VN", tr: "tr-TR", fa: "fa-IR",
  };
  const locale = localeMap[lang] || "en-US";
  const fmtOpts = {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: lang === "en",
  };
  if (opts.withWeekday) fmtOpts.weekday = opts.long ? "long" : "short";
  if (opts.withDate) {
    fmtOpts.month = opts.long ? "long" : "short";
    fmtOpts.day = "numeric";
  }
  if (opts.withYear) fmtOpts.year = "numeric";

  const formatted = new Intl.DateTimeFormat(locale, fmtOpts).format(date);
  const abbr = window.tzAbbrev(date, tz);
  return `${formatted} ${abbr}`;
};
