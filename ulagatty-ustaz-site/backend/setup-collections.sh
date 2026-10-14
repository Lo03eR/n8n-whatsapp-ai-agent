#!/usr/bin/env bash
# ============================================================
#  setup-collections.sh — создаёт коллекции `articles` и
#  `publish_requests` в Directus через API (одной командой).
#
#  Запуск из папки backend (Directus уже должен работать):
#      bash setup-collections.sh
#  или с явным адресом API:
#      bash setup-collections.sh http://localhost:8055
#
#  Логин/пароль админа берутся из .env (ADMIN_EMAIL/ADMIN_PASSWORD).
#  Скрипт безопасно повторять: уже существующие коллекции пропускаются.
#  Права «публичное чтение» настраиваются в админке (4 клика) — см. конец.
# ============================================================
set -euo pipefail

API="${1:-http://localhost:8055}"
cd "$(dirname "$0")"

# --- читаем доступы админа из .env ---
ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2-)"
ADMIN_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' .env | cut -d= -f2-)"
if [ -z "${ADMIN_EMAIL:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Не нашёл ADMIN_EMAIL/ADMIN_PASSWORD в .env"; exit 1
fi

echo "→ Вход в Directus ($API)…"
TOKEN="$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | grep -oP '"access_token":"\K[^"]+' || true)"
if [ -z "$TOKEN" ]; then
  echo "Не удалось войти. Проверь ADMIN_EMAIL/ADMIN_PASSWORD и что Directus запущен."; exit 1
fi
echo "   ок"

auth=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

exists() {  # 200 если коллекция уже есть
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "${auth[@]}" "$API/collections/$1")"
  [ "$code" = "200" ]
}

create_collection() {  # $1 = имя, $2 = JSON тела
  if exists "$1"; then echo "→ Коллекция '$1' уже существует — пропускаю"; return; fi
  echo "→ Создаю коллекцию '$1'…"
  local resp
  resp="$(curl -s -X POST "$API/collections" "${auth[@]}" -d "$2")"
  if echo "$resp" | grep -q '"errors"'; then
    echo "   ОШИБКА: $resp"; exit 1
  fi
  echo "   ок"
}

# ---------------- articles ----------------
read -r -d '' ARTICLES <<'JSON' || true
{
  "collection": "articles",
  "meta": { "icon": "article", "note": "Статьи портала", "sort_field": "date_published" },
  "schema": {},
  "fields": [
    { "field": "id", "type": "integer", "meta": { "hidden": true, "interface": "input", "readonly": true }, "schema": { "is_primary_key": true, "has_auto_increment": true } },
    { "field": "status", "type": "string",
      "meta": { "interface": "select-dropdown", "display": "labels", "width": "half",
        "options": { "choices": [
          { "text": "Опубликовано", "value": "published" },
          { "text": "Черновик", "value": "draft" },
          { "text": "В архиве", "value": "archived" } ] },
        "display_options": { "choices": [
          { "text": "Опубликовано", "value": "published", "foreground": "#FFFFFF", "background": "#2aa564" },
          { "text": "Черновик", "value": "draft", "foreground": "#FFFFFF", "background": "#A2B5CD" },
          { "text": "В архиве", "value": "archived", "foreground": "#FFFFFF", "background": "#E35169" } ] } },
      "schema": { "default_value": "draft" } },
    { "field": "title", "type": "string", "meta": { "interface": "input", "required": true, "options": { "placeholder": "Заголовок статьи" } } },
    { "field": "slug", "type": "string", "meta": { "interface": "input", "width": "half", "options": { "slug": true, "placeholder": "zagolovok-stati" }, "note": "Адрес статьи (article.html?slug=)" }, "schema": { "is_unique": true } },
    { "field": "date_published", "type": "timestamp", "meta": { "interface": "datetime", "width": "half", "display": "datetime" } },
    { "field": "categories", "type": "json", "meta": { "interface": "tags", "special": ["cast-json"], "options": { "placeholder": "Ұстаз, Мектеп тынысы, Тәрбие сағаты, Әдістеме" }, "note": "Категории — те же названия, что на сайте" } },
    { "field": "content", "type": "text", "meta": { "interface": "input-rich-text-html", "note": "Текст статьи" } },
    { "field": "featured_image", "type": "uuid", "meta": { "interface": "file-image", "special": ["file"], "width": "half", "note": "Обложка" } },
    { "field": "author", "type": "string", "meta": { "interface": "input", "width": "half", "options": { "placeholder": "ФИО автора" } } },
    { "field": "views", "type": "integer", "meta": { "interface": "input", "width": "half", "readonly": true, "note": "Счётчик просмотров" }, "schema": { "default_value": 0 } }
  ]
}
JSON
create_collection "articles" "$ARTICLES"

# ---------------- publish_requests ----------------
read -r -d '' REQUESTS <<'JSON' || true
{
  "collection": "publish_requests",
  "meta": { "icon": "inbox", "note": "Заявки на публикацию (форма + Telegram-бот)", "sort_field": "date_created" },
  "schema": {},
  "fields": [
    { "field": "id", "type": "integer", "meta": { "hidden": true, "interface": "input", "readonly": true }, "schema": { "is_primary_key": true, "has_auto_increment": true } },
    { "field": "status", "type": "string",
      "meta": { "interface": "select-dropdown", "display": "labels", "width": "half",
        "options": { "choices": [
          { "text": "Новая", "value": "new" },
          { "text": "Одобрена", "value": "approved" },
          { "text": "Отклонена", "value": "rejected" } ] } },
      "schema": { "default_value": "new" } },
    { "field": "author_name", "type": "string", "meta": { "interface": "input", "width": "half", "options": { "placeholder": "Кто прислал" } } },
    { "field": "author_contact", "type": "string", "meta": { "interface": "input", "width": "half", "options": { "placeholder": "Телефон / Telegram" } } },
    { "field": "category", "type": "string", "meta": { "interface": "select-dropdown", "width": "half",
        "options": { "choices": [
          { "text": "Ұстаз", "value": "Ұстаз" },
          { "text": "Мектеп тынысы", "value": "Мектеп тынысы" },
          { "text": "Тәрбие сағаты", "value": "Тәрбие сағаты" },
          { "text": "Әдістеме", "value": "Әдістеме" } ] } } },
    { "field": "title", "type": "string", "meta": { "interface": "input", "options": { "placeholder": "Тема статьи" } } },
    { "field": "work", "type": "string", "meta": { "interface": "input", "width": "half", "note": "Место работы" } },
    { "field": "region", "type": "string", "meta": { "interface": "input", "width": "half", "note": "Район, область" } },
    { "field": "body", "type": "text", "meta": { "interface": "input-rich-text-html" } },
    { "field": "article_file", "type": "uuid", "meta": { "interface": "file", "special": ["file"], "width": "half", "note": "Файл статьи (если прислали файлом)" } },
    { "field": "payment_proof", "type": "uuid", "meta": { "interface": "file", "special": ["file"], "width": "half", "note": "Чек об оплате (PDF)" } },
    { "field": "photo", "type": "uuid", "meta": { "interface": "file-image", "special": ["file"], "width": "half", "note": "Фото статьи (станет обложкой)" } },
    { "field": "tg_user_id", "type": "string", "meta": { "interface": "input", "width": "half", "readonly": true, "note": "Telegram ID автора (для уведомлений бота)" } },
    { "field": "date_created", "type": "timestamp", "meta": { "interface": "datetime", "special": ["date-created"], "width": "half", "readonly": true } }
  ]
}
JSON
create_collection "publish_requests" "$REQUESTS"

# ---------------- certificates (реестр сертификатов) ----------------
read -r -d '' CERTS <<'JSON' || true
{
  "collection": "certificates",
  "meta": { "icon": "workspace_premium", "note": "Реестр выданных сертификатов", "sort_field": "date_issued" },
  "schema": {},
  "fields": [
    { "field": "id", "type": "integer", "meta": { "hidden": true, "interface": "input", "readonly": true }, "schema": { "is_primary_key": true, "has_auto_increment": true } },
    { "field": "number", "type": "string", "meta": { "interface": "input", "readonly": true, "note": "Рег. номер (в QR)" }, "schema": { "is_unique": true } },
    { "field": "fio", "type": "string", "meta": { "interface": "input", "note": "ФИО" } },
    { "field": "topic", "type": "string", "meta": { "interface": "input", "note": "Тема материала" } },
    { "field": "type", "type": "string", "meta": { "interface": "select-dropdown", "width": "half",
        "options": { "choices": [
          { "text": "Сертификат", "value": "cert" },
          { "text": "Құттықтау / Поздравление", "value": "congrat" },
          { "text": "Алғыс хат / Благодарственное", "value": "thanks" } ] } },
      "schema": { "default_value": "cert" } },
    { "field": "tg_user_id", "type": "string", "meta": { "interface": "input", "width": "half", "readonly": true, "hidden": true } },
    { "field": "date_issued", "type": "timestamp", "meta": { "interface": "datetime", "special": ["date-created"], "width": "half", "readonly": true } }
  ]
}
JSON
create_collection "certificates" "$CERTS"

echo ""
echo "Готово ✅  Коллекции созданы."
echo ""
echo "Осталось 1 действие в админке (публичное чтение статей):"
echo "  Settings → Access Policies → Public →"
echo "    + добавь права READ для 'articles' с фильтром status = published"
echo "    + добавь права READ для 'Directus Files' (чтобы грузились обложки)"
echo "  Сохрани. Проверь: $API/items/articles?filter[status][_eq]=published"
