#!/usr/bin/env bash
# ============================================================
#  add-photo-fields.sh — добавляет в коллекцию `articles` поля
#  управления обложкой: положение и размер фото отдельно для ПК и
#  телефона. Запуск из ~/backend (рядом .env):
#      cd ~/backend && bash add-photo-fields.sh
#  Повторять безопасно: уже существующие поля пропускаются.
# ============================================================
set -euo pipefail
API="${1:-http://localhost:8055}"
cd "$(dirname "$0")"

ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2-)"
ADMIN_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' .env | cut -d= -f2-)"
[ -z "${ADMIN_EMAIL:-}" ] && { echo "Нет ADMIN_EMAIL/ADMIN_PASSWORD в .env (запускай из ~/backend)"; exit 1; }

echo "→ Вход в Directus ($API)…"
TOKEN="$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | grep -oP '"access_token":"\K[^"]+' || true)"
[ -z "$TOKEN" ] && { echo "Не удалось войти. Проверь ADMIN_EMAIL/ADMIN_PASSWORD."; exit 1; }
auth=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

POS='[{"text":"По центру","value":"center"},{"text":"Сверху","value":"center top"},{"text":"Снизу","value":"center bottom"},{"text":"Слева","value":"left center"},{"text":"Справа","value":"right center"}]'
SIZE='[{"text":"Заполнить","value":"cover"},{"text":"Целиком","value":"contain"},{"text":"Крупнее ×1.2","value":"120%"},{"text":"Крупнее ×1.5","value":"150%"},{"text":"Крупнее ×2","value":"200%"}]'

add_field() { # $1=field $2=note $3=choices-json $4=default
  if curl -s -o /dev/null -w '%{http_code}' "${auth[@]}" "$API/fields/articles/$1" | grep -q '^200$'; then
    echo "   поле '$1' уже есть — пропускаю"; return
  fi
  local body
  body="{\"field\":\"$1\",\"type\":\"string\",\"meta\":{\"interface\":\"select-dropdown\",\"width\":\"half\",\"note\":\"$2\",\"options\":{\"choices\":$3}},\"schema\":{\"default_value\":$4}}"
  curl -s -o /dev/null -w "   %{http_code} $1\n" -X POST "$API/fields/articles" "${auth[@]}" -d "$body"
}

echo "→ Добавляю поля обложки в articles…"
add_field "img_pos"         "Положение фото (ПК)"                       "$POS"  '"center"'
add_field "img_size"        "Размер фото (ПК)"                          "$SIZE" '"cover"'
add_field "img_pos_mobile"  "Положение фото (телефон). Пусто = как ПК"  "$POS"  'null'
add_field "img_size_mobile" "Размер фото (телефон). Пусто = как ПК"     "$SIZE" 'null'

echo ""
echo "Готово ✅  Коды 200 = поле создано. Теперь в статье (Content → Articles) есть"
echo "«Положение/Размер фото» для ПК и телефона. Выбор применяется на сайте сразу."
