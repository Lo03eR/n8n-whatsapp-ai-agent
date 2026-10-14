// ============================================================
//  sitemap-gen.mjs — генерирует sitemap.xml для поисковиков
//  (статические страницы + все опубликованные статьи из Directus).
//  Запуск — см. backend/SEO.md. Пишет в /out/sitemap.xml.
// ============================================================
import fs from "fs";

const SITE = (process.env.SITE_URL || "https://ulagattyustaz.kz").replace(/\/+$/, "");
const D = (process.env.DIRECTUS_URL || "http://directus:8055").replace(/\/+$/, "");
const OUT = process.env.OUT || "/out/sitemap.xml";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const statics = ["/", "/category.html", "/contact.html", "/certificate.html", "/privacy.html", "/terms.html"];
const cats = ["ustaz", "school", "tarbie", "method"].map((c) => "/category.html?c=" + c);

let arts = [];
try {
  const r = await fetch(D + "/items/articles?filter[status][_eq]=published&fields=slug,date_published&limit=2000");
  const j = await r.json();
  arts = (j.data || []).filter((a) => a.slug);
} catch (e) { console.error("Directus fetch error:", e.message); }

const urls = [
  ...statics.map((u) => ({ loc: SITE + u })),
  ...cats.map((u) => ({ loc: SITE + u })),
  ...arts.map((a) => ({ loc: SITE + "/article.html?slug=" + encodeURIComponent(a.slug), lastmod: a.date_published })),
];

const body = urls.map((u) => {
  const lm = u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${esc(u.loc)}</loc>${lm}</url>`;
}).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
fs.writeFileSync(OUT, xml);
console.log("sitemap.xml записан:", urls.length, "URL →", OUT);
