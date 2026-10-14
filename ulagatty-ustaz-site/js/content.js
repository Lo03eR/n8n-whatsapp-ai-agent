/* ============================================================
   content.js — наполняет сайт реальными статьями из data/articles.json.

   Как работает:
     • если файла data/articles.json нет (или сайт открыт через file://
       без мини-сервера) — ничего не ломается: остаётся демо-разметка;
     • если файл есть — слайдер, ленты, страницы категорий и статьи
       автоматически заполняются реальными данными экспорта.

   Формат одной статьи (как выгружает tools/export_console.js и export_wp.*):
     { id, title, slug, date, link, categories:[...],
       excerpt_html, content_html, featured_image }

   Чтобы наполнить сайт: положите articles.json в папку data/ рядом с index.html.
   ============================================================ */
(function () {
  "use strict";

  /* ---- какие категории WordPress попадают в какой раздел сайта ---- */
  // ключ раздела -> список «меток» (ищем по подстроке, регистр не важен)
  var CAT_RULES = {
    ustaz:  ["ұстаз", "устаз", "ustaz", "педагог", "мұғалім", "мугалим", "учитель"],
    school: ["мектеп", "mektep", "школ", "білім ордас", "тыныс"],
    tarbie: ["тәрбие", "тарбие", "tarbie", "рухани", "воспит", "құттықтау", "мереке"],
    method: ["әдісте", "adiste", "метод", "сабақ", "технолог", "сауаттыл"],
  };

  // иллюстрации-заглушки (если у статьи нет картинки)
  var ILL = ["ill-1", "ill-2", "ill-3", "ill-4", "ill-5", "ill-6"];

  /* ---- утилиты ---- */
  function stripTags(s) { return (s || "").replace(/<[^>]+>/g, "").trim(); }
  // безопасный текст для вставки через innerHTML (защита от XSS в заголовках)
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function safeTitle(s) { return esc(stripTags(s)); }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return stripTags(iso);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
  }

  function bucketOf(article) {
    var cats = (article.categories || []).join(" ").toLowerCase();
    for (var key in CAT_RULES) {
      var marks = CAT_RULES[key];
      for (var i = 0; i < marks.length; i++) {
        if (cats.indexOf(marks[i]) !== -1) return key;
      }
    }
    return "other";
  }

  function illFor(article) {
    var id = Number(article.id) || 0;
    return ILL[id % ILL.length];
  }

  function hrefFor(article) {
    // с бэкендом — «чистые» адреса (их пререндерит backend/prerender.mjs)
    if (apiBase() && article.slug) return "/article/" + encodeURIComponent(article.slug) + "/";
    if (article.slug) return "article.html?slug=" + encodeURIComponent(article.slug);
    return "article.html?id=" + encodeURIComponent(article.id);
  }

  var CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';
  var EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  function fmtViews(n) {
    n = Number(n) || 0;
    return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k" : String(n);
  }

  /* media-блок карточки: реальная картинка или градиент-заглушка */
  function media(article, withCat) {
    var cover;
    if (article.featured_image) {
      cover = '<div class="cover" style="background-image:url(\'' +
        String(article.featured_image).replace(/'/g, "%27") +
        '\');background-size:cover;background-position:center"></div>';
    } else {
      cover = '<div class="cover ' + illFor(article) + '"></div>';
    }
    var cat = "";
    if (withCat) {
      var b = bucketOf(article);
      var i18nKey = { ustaz: "sec.ustaz", school: "sec.school", tarbie: "sec.tarbie", method: "sec.method", other: "sec.allnews" }[b];
      cat = '<span class="ncat" data-i18n="' + i18nKey + '"></span>';
    }
    return '<div class="nmedia">' + cover + cat + "</div>";
  }

  /* карточка .news-card */
  function card(article, withCat) {
    var a = document.createElement("a");
    a.className = "news-card reveal";
    a.href = hrefFor(article);
    a.innerHTML = media(article, withCat) +
      '<div class="nbody"><h3>' + safeTitle(article.title) + "</h3>" +
      '<span class="ndate">' + CAL_SVG + fmtDate(article.date) + "</span>" +
      '<span class="ndate" style="margin-left:12px" title="просмотры">' + EYE_SVG + fmtViews(article.views) + "</span>" +
      "</div>";
    return a;
  }

  /* ---- заполнение главной ---- */
  function renderHome(list) {
    // слайдер (топ-3)
    var slides = document.getElementById("slides");
    if (slides) {
      slides.innerHTML = "";
      list.slice(0, 3).forEach(function (art) {
        var b = bucketOf(art);
        var i18nKey = { ustaz: "sec.ustaz", school: "sec.school", tarbie: "sec.tarbie", method: "sec.method", other: "sec.allnews" }[b];
        var cover = art.featured_image
          ? '<div class="cover" style="background-image:url(\'' + String(art.featured_image).replace(/'/g, "%27") + '\');background-size:cover;background-position:center"></div>'
          : '<div class="cover ' + illFor(art) + '"></div>';
        var a = document.createElement("a");
        a.className = "slide";
        a.href = hrefFor(art);
        a.innerHTML = cover + '<div class="shade"></div><div class="scontent">' +
          '<span class="scat" data-i18n="' + i18nKey + '"></span>' +
          "<h3>" + safeTitle(art.title) + "</h3>" +
          '<span class="sdate">' + CAL_SVG + fmtDate(art.date) + "</span></div>";
        slides.appendChild(a);
      });
    }

    // боковой список (следующие 4)
    var side = document.querySelector("[data-side-featured]");
    if (side) {
      side.innerHTML = "";
      list.slice(3, 7).forEach(function (art) {
        var a = document.createElement("a");
        a.className = "side-item";
        a.href = hrefFor(art);
        var thumb = art.featured_image
          ? '<span class="sthumb" style="background-image:url(\'' + String(art.featured_image).replace(/'/g, "%27") + '\');background-size:cover;background-position:center"></span>'
          : '<span class="sthumb ' + illFor(art) + '"></span>';
        a.innerHTML = thumb + "<div><h4>" + safeTitle(art.title) + '</h4><div class="sdate">' + fmtDate(art.date) + "</div></div>";
        side.appendChild(a);
      });
    }

    // лента «Соңғы жаңалықтар»
    fillFeed(document.getElementById("latestFeed"), list.slice(0, 6), true);

    // секции-категории
    ["ustaz", "school", "tarbie"].forEach(function (key) {
      var box = document.querySelector('[data-feed="' + key + '"]');
      if (!box) return;
      var items = list.filter(function (a) { return bucketOf(a) === key; }).slice(0, 4);
      if (!items.length) items = list.slice(0, 4); // не оставлять пусто
      fillFeed(box, items, false);
    });

    // «Көп оқылған» (просто первые по списку)
    fillPopular(list.slice(0, 5));
  }

  function fillFeed(box, items, withCat) {
    if (!box || !items.length) return;
    box.innerHTML = "";
    items.forEach(function (art) { box.appendChild(card(art, withCat)); });
  }

  function fillPopular(items) {
    document.querySelectorAll("[data-popular]").forEach(function (box) {
      // удалить старые ранги, оставить заголовок
      box.querySelectorAll(".rank-item").forEach(function (n) { n.remove(); });
      items.forEach(function (art, i) {
        var row = document.createElement("div");
        row.className = "rank-item";
        var a = document.createElement("a");
        a.href = hrefFor(art);
        a.style.cssText = "display:flex;gap:10px;align-items:flex-start;text-decoration:none;color:inherit";
        a.innerHTML = '<span class="num">' + (i + 1) + "</span>" +
          "<div><h4>" + safeTitle(art.title) + '</h4><div class="rdate">' + fmtDate(art.date) + "</div></div>";
        row.appendChild(a);
        box.appendChild(row);
      });
    });
  }

  /* ---- страница категории ---- */
  function renderCategory(list) {
    var box = document.querySelector('[data-feed="category"]');
    if (!box) return;
    var c = new URLSearchParams(location.search).get("c") || "all";
    var items = (c === "all")
      ? list
      : list.filter(function (a) { return bucketOf(a) === c; });
    if (!items.length) items = list;
    fillFeed(box, items, true);
    fillPopular(list.slice(0, 4));
  }

  /* ---- страница статьи ---- */
  function renderArticle(list) {
    var titleEl = document.getElementById("artTitle");
    if (!titleEl) return;
    var params = new URLSearchParams(location.search);
    var slug = params.get("slug"), id = params.get("id");
    // «чистый» адрес /article/<slug>/ — вытащить slug из пути
    if (!slug && !id) {
      var mm = location.pathname.match(/\/article\/([^\/]+)\/?$/);
      if (mm) slug = decodeURIComponent(mm[1]);
    }
    var art = null;
    if (slug) art = list.find(function (a) { return a.slug === slug; });
    if (!art && id) art = list.find(function (a) { return String(a.id) === String(id); });
    if (!art) art = list[0];
    if (!art) return;

    var b = bucketOf(art);
    var i18nKey = { ustaz: "sec.ustaz", school: "sec.school", tarbie: "sec.tarbie", method: "sec.method", other: "sec.allnews" }[b];

    document.title = stripTags(art.title) + " — Ұлағатты Ұстаз.kz";
    titleEl.textContent = stripTags(art.title);

    // ---- SEO: мета-теги под конкретную статью ----
    var plainTitle = stripTags(art.title);
    var descText = stripTags(art.excerpt_html || art.content_html || "").slice(0, 180);
    var pageUrl = "https://ulagattyustaz.kz/article.html?slug=" + encodeURIComponent(art.slug || "");
    var setAttr = function (id, attr, val) { var el = document.getElementById(id); if (el) el.setAttribute(attr, val); };
    setAttr("metaDesc", "content", descText || plainTitle);
    setAttr("metaCanonical", "href", pageUrl);
    setAttr("ogTitle", "content", plainTitle);
    setAttr("ogDesc", "content", descText || plainTitle);
    setAttr("ogUrl", "content", pageUrl);
    if (art.featured_image) setAttr("ogImage", "content", art.featured_image);
    try {
      var ld = { "@context": "https://schema.org", "@type": "NewsArticle",
        headline: plainTitle, datePublished: art.date || undefined,
        author: { "@type": "Person", name: "Ұлағатты Ұстаз.kz" },
        publisher: { "@type": "Organization", name: "Ұлағатты Ұстаз.kz" },
        mainEntityOfPage: pageUrl };
      if (art.featured_image) ld.image = [art.featured_image];
      var s = document.createElement("script");
      s.type = "application/ld+json"; s.textContent = JSON.stringify(ld);
      document.head.appendChild(s);
    } catch (e) {}

    var crumb = document.getElementById("artCrumb");
    if (crumb) crumb.textContent = stripTags(art.title).slice(0, 40);
    var crumbCat = document.getElementById("artCrumbCat");
    if (crumbCat) { crumbCat.href = "category.html?c=" + (b === "other" ? "" : b); crumbCat.setAttribute("data-i18n", i18nKey); }

    var eyebrow = document.getElementById("artEyebrow");
    if (eyebrow) eyebrow.setAttribute("data-i18n", i18nKey);

    var dateEl = document.getElementById("artDate");
    if (dateEl) dateEl.innerHTML = CAL_SVG + fmtDate(art.date);

    var hero = document.getElementById("artHero");
    if (hero) {
      hero.innerHTML = art.featured_image
        ? '<img src="' + String(art.featured_image).replace(/"/g, "%22") + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">'
        : '<div class="cover ' + illFor(art) + '"></div>';
    }

    var body = document.getElementById("artBody");
    var base = apiBase();
    function showBody(html) {
      if (!body) return;
      body.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(html || "") : (html || "");
    }
    if (base && art.id != null && !art.content_html) {
      // content не тянули в списке — грузим его для этой статьи
      fetch(base + "/items/articles/" + art.id + "?fields=content", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { showBody((j && j.data && j.data.content) || ""); })
        .catch(function () { showBody(""); });
    } else {
      showBody(art.content_html || ("<p>" + stripTags(art.excerpt_html) + "</p>"));
    }

    // просмотры: показать и засчитать +1 (один раз за сессию на статью)
    var vEl = document.getElementById("artViews");
    var counted = false;
    if (base && art.id != null) {
      try {
        var k = "seen_" + art.id;
        if (!sessionStorage.getItem(k)) {
          sessionStorage.setItem(k, "1");
          counted = true;
          fetch(base + "/items/articles/" + art.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ views: (art.views || 0) + 1 }),
          }).catch(function () {});
        }
      } catch (e) {}
    }
    if (vEl) vEl.textContent = fmtViews((art.views || 0) + (counted ? 1 : 0));

    // похожие — та же категория, кроме текущей
    var related = list.filter(function (a) { return a !== art && bucketOf(a) === b; }).slice(0, 3);
    if (related.length < 3) {
      list.forEach(function (a) { if (a !== art && related.indexOf(a) === -1 && related.length < 3) related.push(a); });
    }
    fillFeed(document.querySelector('[data-feed="related"]'), related, false);

    if (window.applyI18n) window.applyI18n();
  }

  /* ---- рекламный блок (управляется из Directus, коллекция ads) ---- */
  function renderAds(base) {
    var banners = document.querySelectorAll(".ad-banner");
    if (!banners.length || !base) return;
    fetch(base + "/items/ads", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var ad = j && j.data;
        // скрыть рекламу, если выключена или пустая
        if (!ad || ad.enabled === false || (!ad.title && !ad.image)) {
          banners.forEach(function (b) { b.style.display = "none"; });
          return;
        }
        var corner = esc(window.UU_LANG === "ru" ? "Реклама" : "Жарнама");
        var link = String(ad.link || "").trim();
        var safeLink = /^https?:\/\//i.test(link) ? link : "";
        var img = ad.image ? (base + "/assets/" + encodeURIComponent(ad.image)) : "";
        var openA = safeLink ? '<a href="' + esc(safeLink) + '" target="_blank" rel="noopener nofollow" style="text-decoration:none;color:inherit;display:block">' : "";
        var closeA = safeLink ? "</a>" : "";
        banners.forEach(function (b) {
          var sidebar = !!b.closest("aside");
          b.style.display = "";
          var html = '<span class="adlabel">' + corner + "</span>";
          if (img) {
            html += openA + '<img src="' + esc(img) + '" alt="' + esc(ad.title || "") + '" style="display:block;width:100%;height:auto">' + closeA;
          } else {
            var badge = ad.badge ? '<span class="ad-badge">' + esc(ad.badge) + "</span>" : "";
            var phone = ad.phone ? '<span class="ad-phone"' + (sidebar ? ' style="margin-left:0"' : "") + ">" + esc(ad.phone) + "</span>" : "";
            var inner = '<div class="ad-inner"' + (sidebar ? ' style="flex-direction:column;align-items:flex-start;text-align:left"' : "") + ">" +
              badge +
              '<div><h4 class="ad-gold">' + esc(ad.title || "") + "</h4><p>" + esc(ad.text || "") + "</p></div>" +
              phone +
            "</div>";
            html += openA + inner + closeA;
          }
          b.innerHTML = html;
        });
      })
      .catch(function () {});
  }

  /* ---- загрузка данных: сначала Directus API, иначе локальный JSON ---- */
  function apiBase() {
    return (window.UU_API || "").replace(/\/+$/, "");
  }

  // преобразуем ответ Directus (коллекция articles) в формат сайта
  function mapDirectus(base, row) {
    var cats = row.categories;
    if (!Array.isArray(cats)) cats = cats ? [cats] : [];
    return {
      id: row.id,
      title: stripTags(row.title || ""),
      slug: row.slug,
      date: row.date_published || row.date_created,
      categories: cats,
      excerpt_html: "",
      content_html: row.content || "",
      featured_image: row.featured_image ? (base + "/assets/" + row.featured_image) : null,
      views: row.views || 0,
    };
  }

  function loadFromApi(base) {
    var url = base + "/items/articles"
      + "?filter[status][_eq]=published"
      + "&sort=-date_published"
      + "&fields=id,title,slug,date_published,categories,featured_image,views"
      + "&limit=500";   // content грузим отдельно на странице статьи — быстрее списки
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !Array.isArray(j.data)) return null;
        return j.data.map(function (row) { return mapDirectus(base, row); });
      })
      .catch(function () { return null; });
  }

  function loadLocal() {
    return fetch("data/articles.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function load() {
    var base = apiBase();
    if (base) {
      return loadFromApi(base).then(function (list) {
        return (list && list.length) ? list : loadLocal();
      });
    }
    return loadLocal();
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderAds(apiBase()); // реклама грузится независимо от статей
    load().then(function (list) {
      if (!Array.isArray(list) || !list.length) return; // нет данных → демо-разметка
      // новые сначала
      list.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

      var page = document.body.getAttribute("data-page");
      if (page === "article") renderArticle(list);
      else if (page === "category") renderCategory(list);
      else if (document.getElementById("slides") || document.getElementById("latestFeed")) renderHome(list);

      // перевести подставленные data-i18n и заново навесить reveal/слайдер
      if (window.applyI18n) window.applyI18n(window.UU_LANG);
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      if (window.UU_initSlider) window.UU_initSlider();
    });
  });
})();
