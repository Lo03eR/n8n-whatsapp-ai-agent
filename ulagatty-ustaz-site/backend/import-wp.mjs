// ============================================================
//  import-wp.mjs — перенос статей со старого WordPress-сайта
//  (ulagatttyustaz.kz, 3 «т») в Directus нового портала.
//
//  Берёт все записи через публичный REST API WordPress, скачивает
//  обложки в Directus Files и создаёт статьи (status=published).
//  Повторный запуск безопасен: статьи с тем же slug пропускаются.
//
//  Env:
//    WP_SITE        (по умолчанию https://ulagatttyustaz.kz)
//    DIRECTUS_URL   (по умолчанию http://directus:8055)
//    DIRECTUS_TOKEN (обязательно — статический токен админа)
//
//  Запуск — см. backend/IMPORT.md
// ============================================================
const WP   = (process.env.WP_SITE || "https://ulagatttyustaz.kz").replace(/\/+$/, "");
const DURL = (process.env.DIRECTUS_URL || "http://directus:8055").replace(/\/+$/, "");
const TOK  = process.env.DIRECTUS_TOKEN || "";
if (!TOK) { console.error("Нет DIRECTUS_TOKEN"); process.exit(1); }

const stripTags = (s) => (s || "").replace(/<[^>]+>/g, "").trim();

async function dj(path, opts = {}) {
  const r = await fetch(DURL + path, { ...opts, headers: { Authorization: `Bearer ${TOK}`, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`Directus ${r.status}: ${await r.text()}`);
  return r.json();
}

async function slugExists(slug) {
  const j = await dj(`/items/articles?filter[slug][_eq]=${encodeURIComponent(slug)}&fields=id&limit=1`);
  return j.data && j.data.length > 0;
}

async function uploadImage(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const name = (url.split("/").pop() || "image").split("?")[0] || "image.jpg";
    const fd = new FormData();
    fd.append("file", new Blob([buf]), name);
    const up = await fetch(`${DURL}/files`, { method: "POST", headers: { Authorization: `Bearer ${TOK}` }, body: fd });
    if (!up.ok) return null;
    return (await up.json()).data.id;
  } catch { return null; }
}

async function getAllPosts() {
  let page = 1, all = [];
  while (true) {
    const url = `${WP}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=1`;
    let r;
    try { r = await fetch(url); } catch (e) { console.error("fetch error:", e.message); break; }
    if (!r.ok) break;
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
    console.log(`  страница ${page}: +${data.length} (всего ${all.length})`);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

function catsOf(post) {
  const out = [];
  const emb = post._embedded || {};
  (emb["wp:term"] || []).forEach((g) => (g || []).forEach((t) => { if (t && t.taxonomy === "category") out.push(t.name); }));
  return out;
}
function featuredUrl(post) {
  const m = (post._embedded || {})["wp:featuredmedia"];
  return m && m[0] && m[0].source_url ? m[0].source_url : null;
}
function authorOf(post) {
  const a = (post._embedded || {}).author;
  return a && a[0] && a[0].name ? a[0].name : null;
}

(async () => {
  console.log(`Импорт из ${WP} → ${DURL}`);
  const posts = await getAllPosts();
  console.log(`Найдено записей: ${posts.length}`);
  let created = 0, skipped = 0, failed = 0;

  for (const p of posts) {
    const slug = p.slug || ("post-" + p.id);
    const title = stripTags(p.title?.rendered || "");
    try {
      if (await slugExists(slug)) { skipped++; console.log(`= пропуск (уже есть): ${title}`); continue; }
      const furl = featuredUrl(p);
      const featured_image = furl ? await uploadImage(furl) : null;
      await dj("/items/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "published",
          title,
          slug,
          date_published: p.date || new Date().toISOString(),
          categories: catsOf(p),
          content: p.content?.rendered || "",
          author: authorOf(p),
          featured_image,
        }),
      });
      created++;
      console.log(`+ создано: ${title}`);
    } catch (e) {
      failed++;
      console.error(`! ошибка на "${title}": ${e.message}`);
    }
  }
  console.log(`\nГотово. Создано: ${created}, пропущено: ${skipped}, ошибок: ${failed}`);
})();
