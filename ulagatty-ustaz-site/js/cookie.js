/* ============================================================
   cookie.js — баннер согласия на cookie / localStorage.
   Показывается один раз; выбор сохраняется в localStorage.
   Двуязычный (ҚАЗ/РУС) по текущему языку сайта.
   ============================================================ */
(function () {
  "use strict";
  try { if (localStorage.getItem("uu_cookie_ok")) return; } catch (e) {}

  var lang = (window.UU_LANG || (function () { try { return localStorage.getItem("uu_lang"); } catch (e) { return null; } })() || "kz");
  var T = {
    kz: {
      text: "Біз сайттың дұрыс жұмысы үшін cookie және жергілікті сақтауды қолданамыз (тіл, қаралымдар). Сайтты пайдалана отырып, сіз ",
      link: "Құпиялылық саясатымен",
      tail: " келісесіз.",
      ok: "Қабылдаймын",
    },
    ru: {
      text: "Мы используем cookie и локальное хранилище для корректной работы сайта (язык, просмотры). Используя сайт, вы соглашаетесь с ",
      link: "Политикой конфиденциальности",
      tail: ".",
      ok: "Принимаю",
    },
  };
  var t = T[lang] || T.kz;

  var bar = document.createElement("div");
  bar.setAttribute("role", "dialog");
  bar.style.cssText = [
    "position:fixed", "left:12px", "right:12px", "bottom:12px", "z-index:9999",
    "max-width:900px", "margin:0 auto", "background:#0f2b1e", "color:#fff",
    "border:1px solid #2aa564", "border-radius:14px", "padding:14px 16px",
    "box-shadow:0 10px 30px rgba(0,0,0,.25)", "font:14px/1.5 Manrope,system-ui,sans-serif",
    "display:flex", "gap:12px", "align-items:center", "flex-wrap:wrap",
  ].join(";");

  var msg = document.createElement("div");
  msg.style.cssText = "flex:1;min-width:220px";
  msg.innerHTML = t.text + '<a href="/privacy.html" style="color:#ffd97a;text-decoration:underline">' + t.link + "</a>" + t.tail;

  var btn = document.createElement("button");
  btn.textContent = t.ok;
  btn.style.cssText = "background:#d4af37;color:#1a1a1a;border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;white-space:nowrap";
  btn.addEventListener("click", function () {
    try { localStorage.setItem("uu_cookie_ok", "1"); } catch (e) {}
    bar.remove();
  });

  bar.appendChild(msg); bar.appendChild(btn);
  function mount() { document.body.appendChild(bar); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
