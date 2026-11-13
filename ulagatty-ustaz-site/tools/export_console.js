/* ============================================================
   Выгрузка всех статей БЕЗ установок — прямо в браузере.
   Как запустить:
     1. Открой сайт:  https://ulagatttyustaz.kz
     2. Нажми F12 → вкладка "Console" (Консоль)
     3. Вставь ВЕСЬ этот код и нажми Enter
     4. Дождись надписи "Готово" — файл articles.json скачается сам
   (запускать именно на самом сайте, чтобы не было ошибки CORS)
   ============================================================ */
(async () => {
  const site = location.origin;
  const perPage = 100;
  let page = 1, all = [];
  console.log("Выгрузка началась…");
  while (true) {
    const url = `${site}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=1`;
    let res;
    try { res = await fetch(url); } catch (e) { console.error(e); break; }
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const it of data) {
      const emb = it._embedded || {};
      let featured = null;
      const media = emb["wp:featuredmedia"];
      if (media && media[0] && media[0].source_url) featured = media[0].source_url;
      const cats = [];
      (emb["wp:term"] || []).forEach(g => g.forEach(t => {
        if (t.taxonomy === "category") cats.push(t.name);
      }));
      all.push({
        id: it.id,
        title: (it.title?.rendered || "").replace(/<[^>]+>/g, "").trim(),
        slug: it.slug,
        date: it.date,
        link: it.link,
        categories: cats,
        excerpt_html: it.excerpt?.rendered || "",
        content_html: it.content?.rendered || "",
        featured_image: featured,
      });
    }
    console.log(`Страница ${page}: всего ${all.length}`);
    if (data.length < perPage) break;
    page++;
  }
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "articles.json";
  document.body.appendChild(a); a.click(); a.remove();
  console.log(`Готово ✅  Статей: ${all.length}. Файл articles.json скачан.`);
})();
