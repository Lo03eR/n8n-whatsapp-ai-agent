/* ============================================================
   config.js — настройки сайта. Подключается ПЕРВЫМ на каждой странице.

   UU_API — адрес бэкенда Directus. Пусто ("") → сайт берёт статьи из
   локального data/articles.json (демо/офлайн). Когда поднимешь Directus:
       window.UU_API = "https://api.ulagattyustaz.kz";

   UU_BOT_URL — ссылка на Telegram-бота публикации (кнопка «Мақала жариялау»).
   UU_WA_URL  — ссылка на WhatsApp. Пока пусто — кнопка ведёт на «Контакты».
   Примеры:
       window.UU_BOT_URL = "https://t.me/ulagatty_bot";
       window.UU_WA_URL  = "https://wa.me/77006464486";
   ============================================================ */
window.UU_API = "";
window.UU_BOT_URL = "";
window.UU_WA_URL = "";
