/* ============================================================
   main.js — interactions. Runs after layout.js + i18n.js.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  /* ---- apply saved language ---- */
  if (window.applyI18n) window.applyI18n(window.UU_LANG);

  /* ---- language switch ---- */
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".lang-switch button");
    if (b) window.applyI18n(b.dataset.lang);
  });

  /* ---- mobile nav ---- */
  const mobileNav = document.getElementById("mobileNav");
  const burger = document.getElementById("burger");
  const mClose = document.getElementById("mClose");
  const openNav = () => mobileNav && mobileNav.classList.add("open");
  const closeNav = () => mobileNav && mobileNav.classList.remove("open");
  burger && burger.addEventListener("click", openNav);
  mClose && mClose.addEventListener("click", closeNav);
  mobileNav && mobileNav.addEventListener("click", (e) => { if (e.target === mobileNav) closeNav(); });
  document.querySelectorAll(".mobile-nav__panel a").forEach(a => a.addEventListener("click", closeNav));

  /* ---- reveal on scroll (with safe fallbacks) ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(el => io.observe(el));
    // safety: never leave content hidden if observer doesn't fire
    setTimeout(() => revealEls.forEach(el => el.classList.add("in")), 2500);
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  /* ---- category chips (filter visual) ---- */
  document.querySelectorAll(".chips").forEach(group => {
    group.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      group.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.cat;
      const grid = document.querySelector(group.dataset.target || ".cards");
      if (grid) grid.querySelectorAll("[data-cat]").forEach(card => {
        card.style.display = (!cat || cat === "all" || card.dataset.cat === cat) ? "" : "none";
      });
    });
  });

  /* ---- auth tabs ---- */
  document.querySelectorAll("[data-tabs]").forEach(tabs => {
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (!btn) return;
      tabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      document.querySelectorAll("[data-pane]").forEach(p => {
        p.style.display = p.dataset.pane === target ? "" : "none";
      });
    });
  });

  /* ---- FAQ accordion ---- */
  document.querySelectorAll(".faq-q").forEach(q => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const a = item.querySelector(".faq-a");
      const open = item.classList.toggle("open");
      a.style.maxHeight = open ? a.scrollHeight + "px" : 0;
    });
  });

  /* ---- toast ---- */
  window.showToast = (msg) => {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => el.classList.remove("show"), 3200);
  };

  /* ---- generic demo forms ---- */
  document.querySelectorAll("form[data-demo]").forEach(f => {
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      showToast(window.t("toast.sent"));
      f.reset();
      const dz = f.querySelector(".dropzone b");
      if (dz) dz.setAttribute("data-i18n", "pay.drop"), window.applyI18n();
    });
  });

  /* ---- dropzone (payment check) ---- */
  document.querySelectorAll(".dropzone").forEach(dz => {
    const input = dz.querySelector("input[type=file]");
    dz.addEventListener("click", () => input && input.click());
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.style.background = "var(--green-100)"; });
    dz.addEventListener("dragleave", () => dz.style.background = "");
    dz.addEventListener("drop", (e) => {
      e.preventDefault(); dz.style.background = "";
      if (e.dataTransfer.files.length && input) { input.files = e.dataTransfer.files; showName(); }
    });
    input && input.addEventListener("change", showName);
    function showName() {
      const label = dz.querySelector("b");
      if (input.files.length) { label.removeAttribute("data-i18n"); label.textContent = "✓ " + input.files[0].name; }
    }
  });

  /* ---- calendar render ---- */
  renderCalendar();

  /* ---- certificate generator ---- */
  initCertificate();
});

/* ============================================================
   Calendar (current month, with sample events)
   ============================================================ */
function renderCalendar() {
  const host = document.getElementById("calGrid");
  if (!host) return;
  const titleEl = document.getElementById("calTitle");
  const now = new Date();
  let view = new Date(now.getFullYear(), now.getMonth(), 1);
  const dowKz = ["Дс","Сс","Ср","Бс","Жм","Сб","Жс"];
  const monthsKz = ["Қаңтар","Ақпан","Наурыз","Сәуір","Мамыр","Маусым","Шілде","Тамыз","Қыркүйек","Қазан","Қараша","Желтоқсан"];
  const events = [5, 12, 18, 25];

  function draw() {
    host.innerHTML = "";
    dowKz.forEach(d => { const c = document.createElement("div"); c.className = "dow"; c.textContent = d; host.appendChild(c); });
    const year = view.getFullYear(), month = view.getMonth();
    if (titleEl) titleEl.textContent = `${monthsKz[month]} ${year}`;
    const first = new Date(year, month, 1);
    let start = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < start; i++) { const c = document.createElement("div"); c.className = "day muted"; host.appendChild(c); }
    for (let d = 1; d <= daysInMonth; d++) {
      const c = document.createElement("div"); c.className = "day"; c.textContent = d;
      if (year === now.getFullYear() && month === now.getMonth() && d === now.getDate()) c.classList.add("today");
      else if (events.includes(d)) c.classList.add("event");
      host.appendChild(c);
    }
  }
  draw();
  const prev = document.getElementById("calPrev"), next = document.getElementById("calNext");
  prev && prev.addEventListener("click", () => { view.setMonth(view.getMonth() - 1); draw(); });
  next && next.addEventListener("click", () => { view.setMonth(view.getMonth() + 1); draw(); });
}

/* ============================================================
   Certificate generator — unique registration number each time
   ============================================================ */
function genCertNumber() {
  // Format: A{7 digits} - {2 digits}{letter}  e.g. A0001535 - 02B
  const n = Math.floor(1000 + Math.random() * 8999999).toString().padStart(7, "0");
  const suffix = Math.floor(1 + Math.random() * 98).toString().padStart(2, "0");
  const letter = "ABCDEHKMPT".charAt(Math.floor(Math.random() * 10));
  return `№A${n} - ${suffix}${letter}`;
}

function qrDataURI() {
  // Deterministic-looking fake QR (decorative) drawn on canvas → dataURI
  const s = 25, px = 6, cv = document.createElement("canvas");
  cv.width = cv.height = s * px;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#111";
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    if (Math.random() > 0.55) ctx.fillRect(x * px, y * px, px, px);
  }
  const corner = (ox, oy) => {
    ctx.fillStyle = "#111"; ctx.fillRect(ox, oy, px * 7, px * 7);
    ctx.fillStyle = "#fff"; ctx.fillRect(ox + px, oy + px, px * 5, px * 5);
    ctx.fillStyle = "#111"; ctx.fillRect(ox + px * 2, oy + px * 2, px * 3, px * 3);
  };
  corner(0, 0); corner((s - 7) * px, 0); corner(0, (s - 7) * px);
  return cv.toDataURL();
}

function initCertificate() {
  const btn = document.getElementById("certGen");
  if (!btn) return;
  const g = (id) => document.getElementById(id);

  const draw = () => {
    const lang = window.UU_LANG;
    const fio = (g("certFio").value || (lang === "kz" ? "ЖАДЫРА АУЕЛБЕК" : "ИМЯ ФАМИЛИЯ")).toUpperCase();
    const topic = (g("certTopic").value || (lang === "kz" ? "ТӘРБИЕШІ – БАЛА ЖҮРЕГІНЕ ЖОЛ ТАБАТЫН МАМАН" : "ТЕМА ОПУБЛИКОВАННОГО МАТЕРИАЛА")).toUpperCase();
    const work = g("certWork").value || (lang === "kz" ? "«Аянат-сұлу» бөбекжай-балабақшасы" : "Место работы");
    const region = g("certRegion").value || (lang === "kz" ? "Жетісай ауданы, Түркістан облысы" : "Район, область");
    const type = g("certType").value;
    const date = new Date().toLocaleDateString(lang === "kz" ? "kk-KZ" : "ru-RU");
    const num = genCertNumber();

    const titleMap = {
      cert: "CERTIFICATE",
      grat: lang === "kz" ? "АЛҒЫС ХАТ" : "БЛАГОДАРНОСТЬ",
      holiday: lang === "kz" ? "ҚҰТТЫҚТАУ" : "ПОЗДРАВЛЕНИЕ",
    };

    g("certPortal").textContent = window.t("cert.portal");
    g("certTitle").textContent = titleMap[type] || "CERTIFICATE";
    g("certNameOut").textContent = fio;
    g("certConfirm").textContent = window.t("cert.confirm") + ":";
    g("certTopicOut").textContent = "«" + topic + "»";
    g("certWorkOut").textContent = (lang === "kz" ? "Жұмыс орны: " : "Место работы: ") + work + ", " + region;
    g("certDateOut").textContent = window.t("cert.date") + ": " + date;
    g("certNoOut").textContent = window.t("cert.no") + " " + num;
    g("certQr").src = qrDataURI();
    document.getElementById("certResult").style.display = "";
    if (window.showToast) window.showToast(window.t("toast.cert"));
    document.getElementById("certResult").scrollIntoView({ behavior: "smooth", block: "center" });
  };

  btn.addEventListener("click", draw);
  const printBtn = document.getElementById("certPrint");
  printBtn && printBtn.addEventListener("click", () => window.print());
}
