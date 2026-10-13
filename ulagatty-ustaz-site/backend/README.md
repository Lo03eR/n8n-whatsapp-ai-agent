# Бэкенд портала — Directus (CMS: база + API + админка)

Ставится на тот же VPS (Ubuntu). СУБД — **SQLite** (файл), отдельный сервер
базы не нужен — так легче для 1 ГБ RAM. Сайт берёт статьи из этого API.

Порядок: **swap → Docker → Directus → поддомен api. + HTTPS → коллекции →
переключить сайт на API**.

---

## 0. Swap 2 ГБ (обязательно на 1 ГБ RAM)
Страховка, чтобы сервис не падал от нехватки памяти.
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h      # проверь: строка Swap = 2.0Gi
```

## 1. Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# выйди из PuTTY и зайди снова, чтобы применилось
```

## 2. Залить папку backend и настроить .env
Залей папку `backend/` (через FileZilla) в `/home/ubuntu/`. Затем:
```bash
cd ~/backend
cp .env.example .env
openssl rand -hex 32     # вставь в DIRECTUS_KEY
openssl rand -hex 32     # вставь в DIRECTUS_SECRET
nano .env                # заполни KEY, SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, домены
```

## 3. Запуск Directus
Сначала создай папки для данных и отдай их пользователю контейнера (UID 1000),
иначе Directus не сможет создать файл БД (ошибка `SQLITE_CANTOPEN`):
```bash
mkdir -p database uploads extensions
sudo chown -R 1000:1000 database uploads extensions
```
Теперь запуск:
```bash
docker compose up -d
docker compose logs -f     # дождись "Server started at ...", потом Ctrl+C
```
Проверка по IP: открой `http://IP_VPS:8055` — должна открыться админка.
(Порт 8055 слушается только локально; снаружи пустим через nginx — шаг 5.)

## 4. Поддомен api. в DNS
В DNS добавь запись:
```
A   api   IP_твоего_VPS
```

## 5. nginx + HTTPS для api.
```bash
sudo cp ~/backend/nginx-api.conf /etc/nginx/sites-available/api.ulagattyustaz.kz
sudo ln -s /etc/nginx/sites-available/api.ulagattyustaz.kz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.ulagattyustaz.kz      # выдаст SSL, включит https
```
Проверка: `https://api.ulagattyustaz.kz/server/health` → `{"status":"ok"}`.

## 6. Создать коллекции
Зайди в `https://api.ulagattyustaz.kz/admin` (логин/пароль из `.env`) и создай
коллекции по файлу **SCHEMA.md**. Не забудь дать **Public → Read** для
`articles` (фильтр `status=published`) и для файлов.

## 7. Переключить сайт на API
На сайте открой `js/config.js` и впиши адрес API:
```js
window.UU_API = "https://api.ulagattyustaz.kz";
```
Перезалей `js/config.js` на сервер (`/var/www/html/js/`). Готово —
сайт начнёт показывать статьи из Directus. Если `UU_API` пустой — сайт
берёт локальный `data/articles.json` (как раньше).

---

## Память: что ещё поможет на 1 ГБ
- Directus idle ≈ 300–450 МБ, с `mem_limit: 700m` не разрастётся.
- Когда добавим **Telegram-бот на n8n** — ему нужно ещё ~350–450 МБ. На 1 ГБ
  вместе будет тесно. Варианты на том шаге: лёгкий бот отдельным мини-скриптом
  (~50 МБ) **или** апгрейд VPS до 2 ГБ. Решим, когда дойдём.

## Полезные команды
```bash
docker compose restart         # перезапуск
docker compose down            # остановить
docker compose pull && docker compose up -d   # обновить Directus
docker stats --no-stream       # сколько ест памяти
```
Бэкап = скопировать папки `database/` (файл data.db) и `uploads/`.
