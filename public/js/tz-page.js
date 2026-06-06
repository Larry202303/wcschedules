/* ============================================================
   tz-page.js — lightweight controller for the static
   /schedule/<country>-time/ pages.

   - Applies UI translations (nav, footer labels) on load.
   - Renders the language switcher into #app-header.
   - Switching language persists the choice (localStorage) and
     reloads with ?lang= so the rest of the site stays in sync.

   It deliberately does NOT translate the pre-rendered schedule
   table: each timezone page is a single indexable English URL.
   ============================================================ */
(function () {
  function init() {
    if (!window.detectLang || !window.applyTranslations) return; // i18n.js not ready
    var lang = window.detectLang();
    window.applyTranslations(lang);
    renderLangSwitcher(lang);
  }

  function renderLangSwitcher(lang) {
    var host = document.getElementById('app-header');
    if (!host || !window.LANG_LIST) return;
    var opts = window.LANG_LIST.map(function (l) {
      return '<option value="' + l.code + '"' + (l.code === lang ? ' selected' : '') +
        '>' + l.flag + ' ' + l.name + '</option>';
    }).join('');
    host.innerHTML = '<select class="lang-select" id="lang-select" aria-label="Language">' + opts + '</select>';

    document.getElementById('lang-select').addEventListener('change', function (e) {
      var code = e.target.value;
      try { localStorage.setItem('wc_lang', code); } catch (err) {}
      var url = new URL(window.location.href);
      url.searchParams.set('lang', code);
      window.location.href = url.toString();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
