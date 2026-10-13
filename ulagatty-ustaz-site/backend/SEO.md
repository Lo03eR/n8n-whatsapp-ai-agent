# SEO — чтобы сайт находили в Google и Яндексе

## 1. Карта сайта (sitemap.xml)
Генерируется из Directus (статические страницы + все опубликованные статьи)
и кладётся в корень сайта. Запускай после добавления новых статей:

```bash
cd ~/backend
docker network ls | grep backend   # обычно backend_default
docker run --rm --network backend_default \
  -v "$PWD/sitemap-gen.mjs:/sitemap-gen.mjs:ro" \
  -v /var/www/html:/out \
  -e DIRECTUS_URL=http://directus:8055 \
  -e SITE_URL=https://ulagattyustaz.kz \
  node:20-alpine node /sitemap-gen.mjs
```
Проверь: `https://ulagattyustaz.kz/sitemap.xml` и `https://ulagattyustaz.kz/robots.txt`.

> Можно автоматизировать (cron раз в день): добавь строку в `crontab -e`:
> `0 3 * * * cd ~/backend && docker run --rm --network backend_default -v "$HOME/backend/sitemap-gen.mjs:/sitemap-gen.mjs:ro" -v /var/www/html:/out -e DIRECTUS_URL=http://directus:8055 -e SITE_URL=https://ulagattyustaz.kz node:20-alpine node /sitemap-gen.mjs`

## 2. Google Search Console
1. Зайди на https://search.google.com/search-console → **Добавить ресурс** →
   домен `ulagattyustaz.kz`.
2. Подтверди владение (проще всего — **DNS TXT-запись** в панели ps.kz, её
   покажет Google; либо HTML-файл в `/var/www/html`).
3. **Файлы Sitemap** → добавь `sitemap.xml`.
4. Через несколько дней в «Покрытие» увидишь проиндексированные страницы.

## 3. Яндекс.Вебмастер (важно для СНГ)
1. https://webmaster.yandex.ru → **Добавить сайт** → `ulagattyustaz.kz`.
2. Подтверди (DNS TXT или HTML-файл).
3. **Индексирование → Файлы Sitemap** → добавь `sitemap.xml`.
4. Добавь регион «Казахстан / Жетысай» в настройках — помогает локальной выдаче.

## 4. Что уже сделано в коде
- Уникальные `<title>` и `description` на страницах, ключевые слова.
- Open Graph (красивые превью при репосте в соцсети/мессенджеры).
- Разметка schema.org (Organization на главной, NewsArticle на статье).
- `robots.txt` + генератор `sitemap.xml`.
- Статьи отдают свои мета-теги (заголовок, описание, картинку).

## 5. Важное ограничение (про JS-рендеринг)
Статьи подгружаются JavaScript-ом из Directus. Google это обычно понимает,
а **Яндекс хуже индексирует JS**. Для максимального ранжирования (особенно в
Яндексе) следующий шаг — **пререндер статей в статический HTML** (генерировать
готовые страницы с текстом и мета). Это отдельная доработка — см. «Этап 2» ниже.

### Этап 2 (по желанию): пререндер + «чистые» адреса
- Генерировать `/<slug>.html` с полным текстом и мета (бот/скрипт при публикации).
- Включить «человеческие» URL `ulagattyustaz.kz/<slug>` вместо `?slug=`.
- Это даёт лучшее индексирование и сниппеты. Скажи — сделаю.
