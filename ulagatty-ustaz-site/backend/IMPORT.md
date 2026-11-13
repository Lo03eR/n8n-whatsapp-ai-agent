# Перенос статей со старого сайта (ulagatttyustaz.kz) в Directus

Скрипт `import-wp.mjs` забирает все записи со старого WordPress через его
публичный REST API и создаёт статьи в Directus (status = published),
скачивая обложки в Directus Files. Запускается **на сервере** (VPS достаёт
старый сайт). Повторный запуск безопасен — статьи с тем же slug пропускаются.

## Запуск

```bash
cd ~/backend
TOKEN=$(grep '^DIRECTUS_TOKEN=' .env | cut -d= -f2-)

# имя docker-сети (обычно backend_default) — проверь, если что:
docker network ls | grep backend

docker run --rm --network backend_default \
  -v "$PWD/import-wp.mjs:/import.mjs:ro" \
  -e DIRECTUS_URL=http://directus:8055 \
  -e DIRECTUS_TOKEN="$TOKEN" \
  -e WP_SITE=https://ulagatttyustaz.kz \
  node:20-alpine node /import.mjs
```

В конце выведет: `Создано: N, пропущено: M, ошибок: K`.

## После импорта
- Статьи сразу появятся на сайте (`https://ulagattyustaz.kz`) после Ctrl+Shift+R.
- Обложки (featured image) скачаны в Directus. Картинки **внутри текста**
  пока ссылаются на старый сайт — они будут грузиться, пока старый сайт жив.
- Категории перенесены как теги с теми же названиями (Ұстаз, Мектеп тынысы, …),
  распределение по разделам — по `js/content.js` → `CAT_RULES`.

## Если сеть называется иначе
Посмотри вывод `docker network ls` и подставь нужное имя в `--network`.
Сеть нужна, чтобы контейнер импорта достучался до Directus по имени `directus`.
