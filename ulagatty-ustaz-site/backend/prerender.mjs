// ============================================================
//  prerender.mjs — генерирует СТАТИЧЕСКИЕ HTML-страницы статей
//  (для SEO: полный текст и мета прямо в HTML) + sitemap.xml.
//
//  Пишет:  /out/article/<slug>/index.html  →  URL  /article/<slug>/
//          /out/sitemap.xml
//
//  Env:
//    DIRECTUS_URL     внутренний адрес Directus (http://directus:8055)
//    DIRECTUS_PUBLIC  публичный адрес API для картинок (https://api.ulagattyustaz.kz)
//    SITE_URL         адрес сайта (https://ulagattyustaz.kz)
//    OUT_DIR          корень сайта (/out)
//  Запуск — см. backend/SEO.md.
// ============================================================
import fs from "fs";
import path from "path";

const D = (process.env.DIRECTUS_URL || "http://directus:8055").replace(/\/+$/, "");
const DPUB = (process.env.DIRECTUS_PUBLIC || "https://api.ulagattyustaz.kz").replace(/\/+$/, "");
const SITE = (process.env.SITE_URL || "https://ulagattyustaz.kz").replace(/\/+$/, "");
const OUT = process.env.OUT_DIR || "/out";

const CAT_RULES = {
  ustaz:  ["ұстаз", "устаз", "ustaz", "педагог", "мұғалім", "мугалим", "учитель"],
  school: ["мектеп", "mektep", "школ", "білім ордас", "тыныс"],
  tarbie: ["тәрбие", "тарбие", "tarbie", "рухани", "воспит", "құттықтау", "мереке"],
  method: ["әдісте", "adiste", "метод", "сабақ", "технолог", "сауаттыл"],
};
const CAT_LABEL = { ustaz: "Ұстаз", school: "Мектеп тынысы", tarbie: "Тәрбие", method: "Әдістеме", other: "Жаңалықтар" };

const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmtDate = (iso) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return ""; const p = (n) => String(n).padStart(2, "0"); return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear(); };

function bucketOf(cats) {
  const s = (cats || []).join(" ").toLowerCase();
  for (const k in CAT_RULES) for (const m of CAT_RULES[k]) if (s.indexOf(m) !== -1) return k;
  return "other";
}
const imgUrl = (id) => (id ? DPUB + "/assets/" + id : null);
// положение/размер обложки (поля img_*) → CSS-переменные, раздельно ПК/телефон
const san = (v) => String(v || "").replace(/[^a-z0-9%.\s-]/gi, "").trim();
const imgStyle = (a) => {
  let s = "";
  if (san(a.img_pos)) s += `--imgpos:${san(a.img_pos)};`;
  if (san(a.img_size)) s += `--imgsize:${san(a.img_size)};`;
  if (san(a.img_pos_mobile)) s += `--imgpos-m:${san(a.img_pos_mobile)};`;
  if (san(a.img_size_mobile)) s += `--imgsize-m:${san(a.img_size_mobile)};`;
  return s;
};
const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';
const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

function cardHtml(a) {
  const b = bucketOf(a.categories);
  const cover = a.featured_image
    ? `<div class="cover" style="background-image:url('${esc(imgUrl(a.featured_image))}');${imgStyle(a)}"></div>`
    : `<div class="cover ill-${(Number(a.id) % 6) + 1}"></div>`;
  return `<a class="news-card" href="/article/${encodeURIComponent(a.slug)}/">` +
    `<div class="nmedia">${cover}<span class="ncat">${esc(CAT_LABEL[b])}</span></div>` +
    `<div class="nbody"><h3>${esc(strip(a.title))}</h3>` +
    `<span class="ndate">${CAL}${fmtDate(a.date_published)}</span></div></a>`;
}

function page(a, related) {
  const title = strip(a.title);
  const b = bucketOf(a.categories);
  const desc = strip(a.content).slice(0, 180);
  const url = `${SITE}/article/${encodeURIComponent(a.slug)}/`;
  const img = imgUrl(a.featured_image);
  const hero = img
    ? `<div class="cover" style="background-image:url('${esc(img)}');${imgStyle(a)}"></div>`
    : `<div class="cover ill-${(Number(a.id) % 6) + 1}"></div>`;
  const ld = {
    "@context": "https://schema.org", "@type": "NewsArticle", headline: title,
    datePublished: a.date_published || undefined, author: { "@type": "Organization", name: "Ұлағатты Ұстаз.kz" },
    publisher: { "@type": "Organization", name: "Ұлағатты Ұстаз.kz" }, mainEntityOfPage: url,
  };
  if (img) ld.image = [img];

  return `<!DOCTYPE html>
<html lang="kk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — Ұлағатты Ұстаз.kz</title>
<meta name="description" content="${esc(desc || title)}">
<meta name="keywords" content="${esc(title)}, педагог мақаласы, ${esc(CAT_LABEL[b])}, Ұлағатты Ұстаз">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Ұлағатты Ұстаз.kz">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc || title)}">
<meta property="og:url" content="${esc(url)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<noscript><style>.reveal{opacity:1;transform:none}</style></noscript>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body data-page="article">
<div id="site-header"></div>
<main class="section">
  <div class="container">
    <div class="article-wrap">
      <div class="breadcrumbs reveal"><a href="/">Басты</a> / <a href="/category.html?c=${b === "other" ? "" : b}">${esc(CAT_LABEL[b])}</a> / <span>${esc(title.slice(0, 40))}</span></div>
      <span class="eyebrow reveal" style="margin:14px 0 10px">${esc(CAT_LABEL[b])}</span>
      <h1 class="reveal" style="font-size:clamp(1.7rem,4vw,2.6rem);line-height:1.2">${esc(title)}</h1>
      <div class="article-meta reveal" style="margin-top:16px">
        ${a.author ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>${esc(a.author)}</span>` : ""}
        <span>${CAL}${fmtDate(a.date_published)}</span>
        <span>${EYE}<b>${Number(a.views) || 0}</b> қаралым</span>
      </div>
      <div class="article-hero reveal">${hero}</div>
      <div class="article-body reveal">${a.content || ""}</div>
      <div class="sec-title reveal" style="margin-top:40px"><h2 style="font-size:1.4rem">Ұқсас материалдар</h2></div>
      <div class="feed feed--3 reveal">${related.map(cardHtml).join("")}</div>
      <p style="margin-top:30px"><a href="/" class="link-arrow">← Басты бетке</a></p>
    </div>
  </div>
</main>
<div id="site-footer"></div>
<script src="/js/config.js"></script>
<script src="/js/i18n.js"></script>
<script src="/js/layout.js"></script>
<script src="/js/main.js"></script>
<script src="/js/cookie.js"></script>
<script>
(function(){var API=(window.UU_API||"").replace(/\\/+$/,"");var id=${Number(a.id) || 0};if(!API||!id)return;
try{var k="seen_"+id;if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");}catch(e){}
fetch(API+"/items/articles/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({views:${Number(a.views) || 0}+1})}).catch(function(){});})();
</script>
</body>
</html>
`;
}

// ---- данные ----
let arts = [];
try {
  const r = await fetch(D + "/items/articles?filter[status][_eq]=published&sort=-date_published&fields=id,title,slug,date_published,categories,content,featured_image,author,views,img_pos,img_size,img_pos_mobile,img_size_mobile&limit=2000");
  const j = await r.json();
  arts = (j.data || []).filter((a) => a.slug);
} catch (e) { console.error("Directus error:", e.message); process.exit(1); }

// ---- генерация страниц ----
let n = 0;
for (const a of arts) {
  const related = arts.filter((x) => x !== a && bucketOf(x.categories) === bucketOf(a.categories)).slice(0, 3);
  while (related.length < 3) { const extra = arts.find((x) => x !== a && !related.includes(x)); if (!extra) break; related.push(extra); }
  const dir = path.join(OUT, "article", a.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(a, related));
  n++;
}

// ---- sitemap.xml (чистые адреса) ----
const statics = ["/", "/category.html", "/contact.html", "/certificate.html", "/privacy.html", "/terms.html",
  "/category.html?c=ustaz", "/category.html?c=school", "/category.html?c=tarbie", "/category.html?c=method"];
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;");
const urls = [
  ...statics.map((u) => `  <url><loc>${xmlEsc(SITE + u)}</loc></url>`),
  ...arts.map((a) => `  <url><loc>${xmlEsc(SITE + "/article/" + encodeURIComponent(a.slug) + "/")}</loc><lastmod>${new Date(a.date_published || Date.now()).toISOString().slice(0, 10)}</lastmod></url>`),
];
fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);

console.log(`Готово ✅  статей: ${n}, sitemap: ${urls.length} URL`);
