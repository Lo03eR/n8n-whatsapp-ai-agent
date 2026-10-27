/* ============================================================
   layout.js — injects shared header & footer on every page.
   Works on file:// (no fetch). Reads <body data-page="...">.
   ============================================================ */
(function () {
  const page = document.body.getAttribute("data-page") || "home";

  const logoSVG = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3l8 4-8 4-8-4 8-4z" fill="#fff" opacity=".95"/>
      <path d="M5 9v4.5c0 1.7 3.1 3.5 7 3.5s7-1.8 7-3.5V9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>
      <circle cx="12" cy="18.5" r="1.1" fill="#ffd97a"/>
    </svg>`;

  // ссылки от корня (/) — чтобы работали и на /article/<slug>/, и на любой странице
  const navItems = [
    { key: "nav.home", href: "/index.html", id: "home" },
    { key: "nav.ustaz", href: "/category.html?c=ustaz", id: "ustaz" },
    { key: "nav.school", href: "/category.html?c=school", id: "school" },
    { key: "nav.tarbie", href: "/category.html?c=tarbie", id: "tarbie" },
    { key: "nav.method", href: "/category.html?c=method", id: "method" },
    { key: "nav.contact", href: "/contact.html", id: "contact" },
  ];

  const navLinks = navItems.map(n =>
    `<a href="${n.href}" data-i18n="${n.key}" class="${n.id === page ? "active" : ""}"></a>`
  ).join("");

  const searchSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>`;

  // Кнопка «Мақала жариялау» ведёт в бота (Telegram/WhatsApp), если задан
  // в config.js; иначе — на страницу контактов. Заказ статьи — только в боте.
  const botUrl = window.UU_BOT_URL || window.UU_WA_URL || "/contact.html";
  const botExternal = !!(window.UU_BOT_URL || window.UU_WA_URL);
  const botAttr = botExternal ? ' target="_blank" rel="noopener"' : "";

  const header = `
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="Ұлағатты Ұстаз">
        <span class="brand__mark">${logoSVG}</span>
        <span class="brand__name">Ұлағатты Ұстаз.kz<small data-i18n="brand.sub"></small></span>
      </a>
      <form class="hsearch" role="search" onsubmit="return false">
        ${searchSVG}
        <input type="search" data-i18n-ph="search.ph" aria-label="search">
      </form>
      <nav class="nav">${navLinks}</nav>
      <div class="header-actions">
        <button class="theme-toggle" id="themeToggle" type="button" aria-label="Тема / Theme">
          <svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
          <svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        </button>
        <div class="lang-switch" role="group" aria-label="Language">
          <button type="button" data-lang="kz">ҚАЗ</button>
          <button type="button" data-lang="ru">РУС</button>
        </div>
        <a href="${botUrl}"${botAttr} class="btn btn--gold" data-i18n="cta.publish"></a>
        <button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>
  <div class="mobile-nav" id="mobileNav">
    <div class="mobile-nav__panel">
      <button class="mobile-nav__close" id="mClose" aria-label="Close">&times;</button>
      <form class="hsearch msearch" role="search">${searchSVG}<input type="search" data-i18n-ph="search.ph" aria-label="search"></form>
      ${navItems.map(n => `<a href="${n.href}" data-i18n="${n.key}" class="${n.id === page ? "active" : ""}"></a>`).join("")}
      <a href="${botUrl}"${botAttr} class="btn btn--gold" style="margin-top:12px" data-i18n="cta.publish"></a>
    </div>
  </div>`;

  const ic = {
    tg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3L2.9 11.7c-1.3.5-1.3 1.3-.2 1.6l4.8 1.5 1.9 5.8c.2.6.4.8.9.8.3 0 .5-.1.7-.3l2.6-2.5 4.8 3.6c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.1-1.1z"/></svg>`,
    wa: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.3 14.7l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 0112 4zm4.5 11c-.2.6-1.3 1.1-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.7-1.2-4.5-4-4.6-4.2-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2.1.3 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.7 1.1 1.4 1.7.9.8 1.6 1.1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.2.1.4.2.5.3.1.2.1.6-.1 1.1z"/></svg>`,
    ig: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
    yt: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.3-.4-4.9a2.5 2.5 0 00-1.8-1.8C19.2 5 12 5 12 5s-7.2 0-8.8.3A2.5 2.5 0 001.4 7C1 8.7 1 12 1 12s0 3.3.4 4.9a2.5 2.5 0 001.8 1.8C4.8 19 12 19 12 19s7.2 0 8.8-.3a2.5 2.5 0 001.8-1.8C23 15.3 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>`,
  };

  const footer = `
  <footer class="site-footer">
    <div class="container footer-top">
      <div>
        <a class="brand" href="/">
          <span class="brand__mark">${logoSVG}</span>
          <span class="brand__name">Ұлағатты Ұстаз.kz<small data-i18n="brand.sub"></small></span>
        </a>
        <p class="fabout" data-i18n="foot.about"></p>
        <div class="socials">
          <a href="${window.UU_BOT_URL || "#"}"${window.UU_BOT_URL ? ' target="_blank" rel="noopener"' : ""} aria-label="Telegram">${ic.tg}</a>
          <a href="${window.UU_WA_URL || "#"}"${window.UU_WA_URL ? ' target="_blank" rel="noopener"' : ""} aria-label="WhatsApp">${ic.wa}</a>
          <a href="#" aria-label="Instagram">${ic.ig}</a>
          <a href="#" aria-label="YouTube">${ic.yt}</a>
        </div>
      </div>
      <div class="footer-col">
        <h4 data-i18n="foot.menu"></h4>
        <a href="/category.html?c=ustaz" data-i18n="nav.ustaz"></a>
        <a href="/category.html?c=school" data-i18n="nav.school"></a>
        <a href="/category.html?c=tarbie" data-i18n="nav.tarbie"></a>
        <a href="/category.html?c=method" data-i18n="nav.method"></a>
      </div>
      <div class="footer-col">
        <h4 data-i18n="foot.resources"></h4>
        <a href="${botUrl}"${botAttr} data-i18n="cta.publish"></a>
        <a href="/certificate.html" data-i18n="nav.certificate"></a>
        <a href="/contact.html#faq" data-i18n="foot.help"></a>
        <a href="/privacy.html" data-i18n="foot.terms"></a>
        <a href="/terms.html" data-i18n="foot.agreement"></a>
      </div>
      <div class="footer-col">
        <h4 data-i18n="foot.contacts"></h4>
        <a href="tel:+77028990735">+7 702 899 0735</a>
        <a href="mailto:ulagatty_ustaz.kz@mail.ru">ulagatty_ustaz.kz@mail.ru</a>
        <a href="/contact.html" data-i18n="ct.hoursv"></a>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© <span id="year"></span> «Ұлағатты Ұстаз». <span data-i18n="foot.rights"></span></span>
      <span data-i18n="foot.reg"></span>
    </div>
  </footer>`;

  const hSlot = document.getElementById("site-header");
  const fSlot = document.getElementById("site-footer");
  if (hSlot) hSlot.outerHTML = header;
  if (fSlot) fSlot.outerHTML = footer;

  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // ---------- UX-полировка: плавные картинки, прогресс чтения, «наверх» ----------
  // 1) плавное появление картинок (.ncover) по мере загрузки
  function markLoaded(img) {
    if (img.dataset.ld) return; img.dataset.ld = "1";
    if (img.complete && img.naturalWidth) { img.classList.add("is-loaded"); return; }
    img.classList.add("img-fade");
    img.addEventListener("load", function () { img.classList.add("is-loaded"); }, { once: true });
    img.addEventListener("error", function () {
      // если уменьшенная/WebP-версия не отдалась — откат на оригинал
      if (!img.dataset.fb && img.src.indexOf("format=webp") >= 0) { img.dataset.fb = "1"; img.src = img.src.split("?")[0]; return; }
      img.classList.add("is-loaded");
    });
  }
  function scanImgs(root) { (root.querySelectorAll ? root.querySelectorAll("img.ncover") : []).forEach(markLoaded); }
  scanImgs(document);
  try {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches("img.ncover")) markLoaded(n);
        scanImgs(n);
      }); });
    }).observe(document.body, { childList: true, subtree: true });
  } catch (e) {}

  // 2) кнопка «наверх» (на всех страницах)
  var toTop = document.createElement("button");
  toTop.id = "toTop"; toTop.setAttribute("aria-label", "Жоғары / Наверх");
  toTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  document.body.appendChild(toTop);

  // 3) полоса прогресса чтения — только на странице статьи
  var readbar = null;
  if (document.body.getAttribute("data-page") === "article") {
    readbar = document.createElement("div"); readbar.id = "readbar";
    document.body.appendChild(readbar);
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var sc = window.pageYOffset || document.documentElement.scrollTop;
      toTop.classList.toggle("show", sc > 400);
      if (readbar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        readbar.style.width = (h > 0 ? Math.min(100, (sc / h) * 100) : 0) + "%";
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
