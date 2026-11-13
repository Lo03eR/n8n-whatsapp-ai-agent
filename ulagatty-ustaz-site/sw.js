/* Service Worker — Ұлағатты Ұстаз.kz (PWA, оффлайн-кеш оболочки) */
const V = "uu-v1";
const CORE = [
  "/css/styles.css", "/js/config.js", "/js/i18n.js", "/js/layout.js",
  "/js/main.js", "/js/content.js", "/js/cookie.js",
  "/favicon.svg", "/manifest.webmanifest", "/icon-192.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== V + "-img").map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // картинки Directus — cache-first (они неизменны по uuid+параметрам)
  if (url.hostname === "api.ulagattyustaz.kz" && url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(V + "-img").then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }
      catch (_) { return hit || Response.error(); }
    }));
    return;
  }
  // остальной API — всегда из сети (свежие данные статей)
  if (url.hostname === "api.ulagattyustaz.kz") return;
  // статика сайта — stale-while-revalidate (быстро + обновляется)
  if (url.origin === location.origin && /\.(css|js|svg|png|jpe?g|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(V).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // страницы — сеть, при оффлайне fallback на кеш/главную
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(req).then((h) => h || caches.match("/"))));
  }
});
