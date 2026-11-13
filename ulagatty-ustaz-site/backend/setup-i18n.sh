#!/usr/bin/env bash
# ============================================================
#  setup-i18n.sh — делает админку Directus двуязычной (ҚАЗ + РУС):
#  переводит названия коллекций и полей на казахский и русский,
#  ставит язык интерфейса по умолчанию.
#
#  Запуск из папки backend (рядом должен быть .env):
#      cd ~/backend && bash setup-i18n.sh
#  или с явным адресом API:
#      bash setup-i18n.sh http://localhost:8055
#
#  Логин/пароль админа берутся из .env (ADMIN_EMAIL/ADMIN_PASSWORD).
#  Повторять безопасно — переводы просто перезаписываются.
#
#  Язык ИНТЕРФЕЙСА каждый выбирает в своём профиле:
#     правый нижний угол (аватар) → профиль → Language → Қазақша/Русский.
# ============================================================
set -euo pipefail

API="${1:-http://localhost:8055}"
cd "$(dirname "$0")"

KZ="kk-KZ"   # казахский (перевод ПОЛЕЙ; как язык интерфейса в Directus недоступен!)
RU="ru-RU"   # русский
# Язык ИНТЕРФЕЙСА по умолчанию. ВАЖНО: ставить только ТО, что реально есть в
# Directus (ru-RU, en-US). kk-KZ в приложении НЕ поддерживается и ломает админку
# (загрузку файлов/сохранение). Поэтому по умолчанию — ru-RU.
DEFAULT_LANG="$RU"

ADMIN_EMAIL="$(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2-)"
ADMIN_PASSWORD="$(grep -E '^ADMIN_PASSWORD=' .env | cut -d= -f2-)"
if [ -z "${ADMIN_EMAIL:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Не нашёл ADMIN_EMAIL/ADMIN_PASSWORD в .env (запускай из ~/backend)"; exit 1
fi

echo "→ Вход в Directus ($API)…"
TOKEN="$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | grep -oP '"access_token":"\K[^"]+' || true)"
[ -z "$TOKEN" ] && { echo "Не удалось войти. Проверь ADMIN_EMAIL/ADMIN_PASSWORD и что Directus запущен."; exit 1; }
echo "   ок"

auth=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')
json_escape() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }

# перевод названия поля (ҚАЗ + РУС)
field_tr() { # $1=collection $2=field $3=kz $4=ru
  local kz ru body
  kz="$(json_escape "$3")"; ru="$(json_escape "$4")"
  body="{\"meta\":{\"translations\":[{\"language\":\"$KZ\",\"translation\":$kz},{\"language\":\"$RU\",\"translation\":$ru}]}}"
  curl -s -o /dev/null -w "   %{http_code} $1.$2\n" -X PATCH "$API/fields/$1/$2" "${auth[@]}" -d "$body"
}

# перевод названия коллекции (ҚАЗ + РУС)
coll_tr() { # $1=collection $2=kz $3=ru
  local kz ru body
  kz="$(json_escape "$2")"; ru="$(json_escape "$3")"
  body="{\"meta\":{\"translations\":[{\"language\":\"$KZ\",\"translation\":$kz},{\"language\":\"$RU\",\"translation\":$ru}]}}"
  curl -s -o /dev/null -w "   %{http_code} [коллекция] $1\n" -X PATCH "$API/collections/$1" "${auth[@]}" -d "$body"
}

echo "→ Язык интерфейса по умолчанию: $DEFAULT_LANG"
curl -s -o /dev/null -w "   %{http_code} settings\n" -X PATCH "$API/settings" "${auth[@]}" \
  -d "{\"default_language\":\"$DEFAULT_LANG\"}"

echo "→ Переводы коллекций…"
coll_tr articles          "Мақалалар"   "Статьи"
coll_tr publish_requests  "Өтініштер"   "Заявки на публикацию"
coll_tr certificates      "Куәліктер"   "Сертификаты"
coll_tr ads               "Жарнама"     "Реклама"

echo "→ Переводы полей: articles…"
field_tr articles status          "Күйі"              "Статус"
field_tr articles title           "Тақырып"           "Заголовок"
field_tr articles slug            "Мекенжай (slug)"   "Адрес (slug)"
field_tr articles date_published  "Жарияланған күні"  "Дата публикации"
field_tr articles categories      "Санаттар"          "Категории"
field_tr articles content         "Мәтін"             "Текст"
field_tr articles featured_image  "Мұқаба суреті"     "Обложка"
field_tr articles author          "Автор"             "Автор"
field_tr articles views           "Қаралым"           "Просмотры"

echo "→ Переводы полей: publish_requests…"
field_tr publish_requests status          "Күйі"           "Статус"
field_tr publish_requests author_name     "Автор (аты-жөні)" "ФИО автора"
field_tr publish_requests author_contact  "Байланыс"       "Контакт"
field_tr publish_requests category        "Санат"          "Категория"
field_tr publish_requests title           "Тақырып"        "Тема"
field_tr publish_requests work            "Жұмыс орны"     "Место работы"
field_tr publish_requests region          "Аудан, облыс"   "Район, область"
field_tr publish_requests body            "Мәтін"          "Текст"
field_tr publish_requests article_file    "Мақала файлы"   "Файл статьи"
field_tr publish_requests payment_proof   "Төлем чегі"     "Чек об оплате"
field_tr publish_requests photo           "Сурет"          "Фото"
field_tr publish_requests tg_user_id      "Telegram ID"    "Telegram ID"
field_tr publish_requests date_created    "Қабылданған күні" "Дата создания"

echo "→ Переводы полей: certificates…"
field_tr certificates number       "Нөмірі"        "Номер"
field_tr certificates fio          "Аты-жөні"      "ФИО"
field_tr certificates topic        "Тақырыбы"      "Тема"
field_tr certificates type         "Түрі"          "Тип документа"
field_tr certificates tg_user_id   "Telegram ID"   "Telegram ID"
field_tr certificates date_issued  "Берілген күні" "Дата выдачи"

echo "→ Переводы полей: ads…"
field_tr ads enabled  "Қосулы"      "Включено"
field_tr ads title    "Тақырып"     "Заголовок"
field_tr ads text     "Сипаттама"   "Описание"
field_tr ads badge    "Белгі"       "Значок (кружок)"
field_tr ads phone    "Телефон"     "Телефон"
field_tr ads link     "Сілтеме"     "Ссылка"
field_tr ads image    "Сурет"       "Картинка-баннер"

echo ""
echo "Готово ✅  Коллекции и поля переведены (ҚАЗ + РУС)."
echo "Язык по умолчанию: $DEFAULT_LANG."
echo "Каждый пользователь может сменить язык: аватар (правый нижний угол) → Language → Қазақша / Русский."
echo "Коды 200/204 = успех. Если видишь 403 — у пользователя нет прав на правку схемы (нужен админ)."
