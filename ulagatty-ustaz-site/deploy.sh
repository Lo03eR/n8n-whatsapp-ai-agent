#!/usr/bin/env bash
# ============================================================
#  deploy.sh — выкладывает сайт в /var/www/html и обновляет код
#  бэкенда в ~/backend (НЕ трогая .env и данные Directus/бота).
#
#  Запуск из папки репозитория:
#      cd ~/n8n-whatsapp-ai-agent && git pull && bash ulagatty-ustaz-site/deploy.sh
#  Применить изменения бэкенда (если менялись bot/compose):
#      cd ~/backend && docker compose up -d --build
# ============================================================
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "→ Сайт → /var/www/html"
sudo mkdir -p /var/www/html
# сохранить сгенерированное (пререндер статей + sitemap) — их нет в репозитории
sudo rm -rf /tmp/uu_keep && sudo mkdir -p /tmp/uu_keep
[ -f /var/www/html/sitemap.xml ] && sudo cp /var/www/html/sitemap.xml /tmp/uu_keep/
[ -d /var/www/html/article ] && sudo cp -r /var/www/html/article /tmp/uu_keep/
sudo rm -rf /var/www/html/*
sudo cp -r "$SRC"/* /var/www/html/
sudo rm -rf /var/www/html/backend /var/www/html/deploy.sh /var/www/html/tools
[ -f /tmp/uu_keep/sitemap.xml ] && sudo mv /tmp/uu_keep/sitemap.xml /var/www/html/sitemap.xml
[ -d /tmp/uu_keep/article ] && sudo cp -r /tmp/uu_keep/article /var/www/html/article
sudo rm -rf /tmp/uu_keep
sudo chown -R www-data:www-data /var/www/html

echo "→ Код бэкенда → ~/backend (кроме .env и данных)"
mkdir -p ~/backend
command -v rsync >/dev/null 2>&1 || sudo apt-get install -y rsync
rsync -a --exclude='.env' --exclude='database/' --exclude='uploads/' \
      --exclude='bot-data/' "$SRC/backend/" ~/backend/

echo ""
echo "Готово ✅"
echo "  Сайт обновлён: /var/www/html"
echo "  Если менялись бот/compose — применить:  cd ~/backend && docker compose up -d --build"
