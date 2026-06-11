/* ============================================================
   tz-page.js — controller for the static
   /schedule/<country>-time/ pages.

   - Renders the language switcher into #app-header.
   - Translates the page CHROME via i18n.js (data-i18n on nav/footer).
   - Translates the page BODY via the self-contained TZP_I18N table
     below (data-tzp elements). "{tz}" is replaced with each element's
     data-tz timezone label (kept in English, e.g. "US Pacific Time").
   - Switching language persists the choice and reloads with ?lang=.

   The pre-rendered schedule rows (dates + team names) stay as-is:
   each timezone page remains a single indexable English URL, and the
   match data is shared verbatim across languages.
   ============================================================ */
(function () {
  // Body strings specific to the timezone pages, in every supported language.
  // {tz} is substituted with the page's timezone label at runtime.
  var TZP_I18N = {
    "en": { h1: "World Cup 2026 Schedule in {tz}", intro: "All kickoff times below are shown in {tz}. Use the language menu above to change the interface language.", watch: "How to Watch", stage: "Stage", match: "Match", details: "Details", why_title: "Why this page exists", why_body: "This page shows the full 2026 World Cup group-stage schedule, pre-converted to {tz}. Every match links to a detailed preview." },
    "zh-CN": { h1: "2026 世界杯赛程（{tz}）", intro: "下方所有开球时间均已换算为 {tz}。可用右上角的语言菜单切换界面语言。", watch: "观赛指南", stage: "阶段", match: "对阵", details: "详情", why_title: "关于本页", why_body: "本页提供 2026 世界杯小组赛完整赛程，已预先换算为 {tz}。每场比赛都可点击查看详细前瞻。" },
    "zh-TW": { h1: "2026 世界盃賽程（{tz}）", intro: "下方所有開球時間均已換算為 {tz}。可用右上角的語言選單切換介面語言。", watch: "觀賽指南", stage: "階段", match: "對陣", details: "詳情", why_title: "關於本頁", why_body: "本頁提供 2026 世界盃小組賽完整賽程，已預先換算為 {tz}。每場比賽皆可點擊查看詳細前瞻。" },
    "es": { h1: "Calendario del Mundial 2026 en {tz}", intro: "Todos los horarios de inicio se muestran en {tz}. Usa el menú de idioma de arriba para cambiar el idioma de la interfaz.", watch: "Cómo ver", stage: "Fase", match: "Partido", details: "Detalles", why_title: "Por qué existe esta página", why_body: "Esta página muestra el calendario completo de la fase de grupos del Mundial 2026, convertido a {tz}. Cada partido enlaza a una vista previa detallada." },
    "pt": { h1: "Calendário da Copa do Mundo 2026 em {tz}", intro: "Todos os horários de início são exibidos em {tz}. Use o menu de idioma acima para mudar o idioma da interface.", watch: "Como assistir", stage: "Fase", match: "Jogo", details: "Detalhes", why_title: "Por que esta página existe", why_body: "Esta página mostra o calendário completo da fase de grupos da Copa do Mundo 2026, convertido para {tz}. Cada jogo tem link para uma prévia detalhada." },
    "fr": { h1: "Calendrier de la Coupe du Monde 2026 en {tz}", intro: "Tous les horaires de coup d'envoi sont affichés en {tz}. Utilisez le menu de langue ci-dessus pour changer la langue de l'interface.", watch: "Comment regarder", stage: "Phase", match: "Match", details: "Détails", why_title: "Pourquoi cette page", why_body: "Cette page présente le calendrier complet de la phase de groupes de la Coupe du Monde 2026, converti en {tz}. Chaque match renvoie à un aperçu détaillé." },
    "de": { h1: "WM 2026 Spielplan in {tz}", intro: "Alle Anstoßzeiten unten sind in {tz} angegeben. Über das Sprachmenü oben kannst du die Sprache ändern.", watch: "Wie zuschauen", stage: "Phase", match: "Spiel", details: "Details", why_title: "Warum es diese Seite gibt", why_body: "Diese Seite zeigt den vollständigen Gruppenphasen-Spielplan der WM 2026, umgerechnet in {tz}. Jedes Spiel verlinkt auf eine ausführliche Vorschau." },
    "ja": { h1: "2026 W杯 日程（{tz}）", intro: "以下のキックオフ時刻はすべて {tz} に変換されています。上部の言語メニューで表示言語を切り替えられます。", watch: "視聴方法", stage: "ステージ", match: "試合", details: "詳細", why_title: "このページについて", why_body: "このページは 2026 FIFAワールドカップのグループステージ全日程を {tz} に変換して表示します。各試合は詳細プレビューにリンクしています。" },
    "ko": { h1: "2026 월드컵 일정 ({tz})", intro: "아래 모든 킥오프 시간은 {tz} 기준입니다. 위의 언어 메뉴에서 인터페이스 언어를 변경할 수 있습니다.", watch: "시청 방법", stage: "단계", match: "경기", details: "상세", why_title: "이 페이지 소개", why_body: "이 페이지는 2026 월드컵 조별리그 전체 일정을 {tz} 기준으로 보여줍니다. 각 경기는 상세 미리보기로 연결됩니다." },
    "ru": { h1: "Расписание ЧМ-2026 в {tz}", intro: "Всё время начала матчей ниже переведено в {tz}. Используйте меню языка вверху, чтобы изменить язык интерфейса.", watch: "Как смотреть", stage: "Этап", match: "Матч", details: "Подробнее", why_title: "О странице", why_body: "На этой странице — полное расписание группового этапа ЧМ-2026, переведённое в {tz}. Каждый матч ведёт к подробному обзору." },
    "ar": { h1: "جدول كأس العالم 2026 بتوقيت {tz}", intro: "جميع مواعيد انطلاق المباريات أدناه معروضة بتوقيت {tz}. استخدم قائمة اللغة في الأعلى لتغيير لغة الواجهة.", watch: "كيفية المشاهدة", stage: "الدور", match: "المباراة", details: "التفاصيل", why_title: "عن هذه الصفحة", why_body: "تعرض هذه الصفحة جدول دور المجموعات الكامل لكأس العالم 2026 بتوقيت {tz}. كل مباراة مرتبطة بمعاينة مفصلة." },
    "id": { h1: "Jadwal Piala Dunia 2026 dalam {tz}", intro: "Semua waktu kick-off di bawah ditampilkan dalam {tz}. Gunakan menu bahasa di atas untuk mengganti bahasa antarmuka.", watch: "Cara menonton", stage: "Babak", match: "Pertandingan", details: "Detail", why_title: "Tentang halaman ini", why_body: "Halaman ini menampilkan jadwal lengkap fase grup Piala Dunia 2026, dikonversi ke {tz}. Setiap pertandingan tertaut ke pratinjau lengkap." },
    "th": { h1: "ตารางฟุตบอลโลก 2026 ตามเวลา {tz}", intro: "เวลาเริ่มแข่งทั้งหมดด้านล่างแสดงเป็นเวลา {tz} ใช้เมนูภาษาด้านบนเพื่อเปลี่ยนภาษาของหน้าเว็บ", watch: "วิธีรับชม", stage: "รอบ", match: "คู่แข่งขัน", details: "รายละเอียด", why_title: "เกี่ยวกับหน้านี้", why_body: "หน้านี้แสดงตารางการแข่งขันรอบแบ่งกลุ่มฟุตบอลโลก 2026 ทั้งหมด แปลงเป็นเวลา {tz} แล้ว แต่ละแมตช์มีลิงก์ไปยังพรีวิวโดยละเอียด" },
    "vi": { h1: "Lịch World Cup 2026 theo {tz}", intro: "Tất cả giờ bóng lăn bên dưới được hiển thị theo {tz}. Dùng menu ngôn ngữ phía trên để đổi ngôn ngữ giao diện.", watch: "Cách xem", stage: "Vòng", match: "Trận đấu", details: "Chi tiết", why_title: "Về trang này", why_body: "Trang này hiển thị toàn bộ lịch vòng bảng World Cup 2026, đã quy đổi sang {tz}. Mỗi trận đều có liên kết tới bản xem trước chi tiết." },
    "tr": { h1: "{tz} ile 2026 Dünya Kupası Fikstürü", intro: "Aşağıdaki tüm başlama saatleri {tz} olarak gösterilir. Arayüz dilini değiştirmek için yukarıdaki dil menüsünü kullanın.", watch: "Nasıl izlenir", stage: "Aşama", match: "Maç", details: "Ayrıntılar", why_title: "Bu sayfa hakkında", why_body: "Bu sayfa 2026 Dünya Kupası grup aşamasının tam fikstürünü {tz} olarak gösterir. Her maç ayrıntılı önizlemeye bağlanır." },
    "fa": { h1: "برنامه جام جهانی ۲۰۲۶ به وقت {tz}", intro: "همه ساعت‌های شروع بازی‌ها در زیر به وقت {tz} نمایش داده شده‌اند. برای تغییر زبان رابط از منوی زبان در بالا استفاده کنید.", watch: "نحوه تماشا", stage: "مرحله", match: "بازی", details: "جزئیات", why_title: "درباره این صفحه", why_body: "این صفحه برنامه کامل مرحله گروهی جام جهانی ۲۰۲۶ را به وقت {tz} نشان می‌دهد. هر بازی به پیش‌نمایش کامل پیوند دارد." }
  };

  function applyTzp(lang) {
    var dict = TZP_I18N[lang] || TZP_I18N.en;
    document.querySelectorAll("[data-tzp]").forEach(function (el) {
      var key = el.getAttribute("data-tzp");
      var s = dict[key] || TZP_I18N.en[key];
      if (!s) return;
      var tz = el.getAttribute("data-tz");
      if (tz) s = s.replace(/\{tz\}/g, tz);
      el.textContent = s;
    });
  }

  function renderLangSwitcher(lang) {
    var host = document.getElementById("app-header");
    if (!host || !window.LANG_LIST) return;
    var opts = window.LANG_LIST.map(function (l) {
      return '<option value="' + l.code + '"' + (l.code === lang ? " selected" : "") +
        ">" + l.flag + " " + l.name + "</option>";
    }).join("");
    host.innerHTML = '<select class="lang-select" id="lang-select" aria-label="Language">' + opts + "</select>";
    document.getElementById("lang-select").addEventListener("change", function (e) {
      var code = e.target.value;
      try { localStorage.setItem("wc_lang", code); } catch (err) {}
      var url = new URL(window.location.href);
      url.searchParams.set("lang", code);
      window.location.href = url.toString();
    });
  }

  function init() {
    var lang = window.detectLang ? window.detectLang() : "en";
    if (window.applyTranslations) window.applyTranslations(lang); // nav + footer (data-i18n)
    applyTzp(lang);                                               // page body (data-tzp)
    renderLangSwitcher(lang);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
