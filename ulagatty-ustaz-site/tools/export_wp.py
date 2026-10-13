#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_wp.py — выгрузка ВСЕХ материалов с ulagatttyustaz.kz (WordPress)
через публичный REST API. Логин/пароль НЕ нужны (контент публичный).

Что делает:
  • скачивает все записи (posts) и страницы (pages) постранично;
  • сохраняет их в export/articles.json и export/pages.json;
  • скачивает featured-картинки и картинки внутри текста в export/images/;
  • переписывает ссылки на картинки в тексте на локальные (images/<file>);
  • сохраняет категории в export/categories.json.

Зависимостей нет — только стандартная библиотека Python 3.
Запуск:
    python3 export_wp.py
    python3 export_wp.py --site https://ulagatttyustaz.kz --out export
    python3 export_wp.py --no-images        # без скачивания картинок
"""

import argparse, json, os, re, sys, time, html
import urllib.request, urllib.error
from urllib.parse import urlparse

UA = "Mozilla/5.0 (compatible; UlagattyExport/1.0)"

def fetch(url, as_json=True, retries=4):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                headers = dict(r.headers)
                return (json.loads(data.decode("utf-8")) if as_json else data), headers
        except urllib.error.HTTPError as e:
            if e.code == 400:            # beyond last page
                return None, {}
            print(f"  HTTP {e.code} на {url} (попытка {attempt+1})", file=sys.stderr)
        except Exception as e:
            print(f"  Ошибка {e} на {url} (попытка {attempt+1})", file=sys.stderr)
        time.sleep(2 * (attempt + 1))
    return None, {}

def get_all(site, endpoint):
    """Постраничная выгрузка коллекции WP REST (_embed даёт картинки и категории)."""
    items, page = [], 1
    while True:
        url = f"{site}/wp-json/wp/v2/{endpoint}?per_page=100&page={page}&_embed=1"
        data, _ = fetch(url)
        if not data:
            break
        items.extend(data)
        print(f"  {endpoint}: страница {page} (+{len(data)}, всего {len(items)})")
        if len(data) < 100:
            break
        page += 1
        time.sleep(0.4)
    return items

def download_image(url, out_dir):
    try:
        name = os.path.basename(urlparse(url).path)
        if not name:
            return None
        path = os.path.join(out_dir, name)
        if not os.path.exists(path):
            data, _ = fetch(url, as_json=False)
            if not data:
                return None
            with open(path, "wb") as f:
                f.write(data)
            time.sleep(0.15)
        return name
    except Exception as e:
        print(f"  Не удалось скачать картинку {url}: {e}", file=sys.stderr)
        return None

def process_items(items, img_dir, download=True):
    out = []
    for it in items:
        content = it.get("content", {}).get("rendered", "")
        # featured image
        featured = None
        emb = it.get("_embedded", {}) or {}
        media = (emb.get("wp:featuredmedia") or [])
        if media and isinstance(media[0], dict):
            featured = media[0].get("source_url")
        # categories
        cats = []
        for term_group in (emb.get("wp:term") or []):
            for term in term_group:
                if term.get("taxonomy") == "category":
                    cats.append(term.get("name"))
        # inline images → download + rewrite
        if download:
            for src in set(re.findall(r'src="([^"]+)"', content)):
                if src.startswith("http"):
                    local = download_image(src, img_dir)
                    if local:
                        content = content.replace(src, f"images/{local}")
            if featured:
                fn = download_image(featured, img_dir)
                if fn:
                    featured = f"images/{fn}"
        out.append({
            "id": it.get("id"),
            "title": html.unescape(re.sub("<[^>]+>", "", it.get("title", {}).get("rendered", ""))).strip(),
            "slug": it.get("slug"),
            "date": it.get("date"),
            "link": it.get("link"),
            "categories": cats,
            "excerpt_html": it.get("excerpt", {}).get("rendered", ""),
            "content_html": content,
            "featured_image": featured,
        })
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="https://ulagatttyustaz.kz")
    ap.add_argument("--out", default="export")
    ap.add_argument("--no-images", action="store_true")
    args = ap.parse_args()

    site = args.site.rstrip("/")
    img_dir = os.path.join(args.out, "images")
    os.makedirs(img_dir, exist_ok=True)
    download = not args.no_images

    print("1) Категории…")
    cats, _ = fetch(f"{site}/wp-json/wp/v2/categories?per_page=100")
    with open(os.path.join(args.out, "categories.json"), "w", encoding="utf-8") as f:
        json.dump(cats or [], f, ensure_ascii=False, indent=2)

    print("2) Записи (posts)…")
    posts = get_all(site, "posts")
    articles = process_items(posts, img_dir, download)
    with open(os.path.join(args.out, "articles.json"), "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print("3) Страницы (pages)…")
    pages = get_all(site, "pages")
    pages_out = process_items(pages, img_dir, download)
    with open(os.path.join(args.out, "pages.json"), "w", encoding="utf-8") as f:
        json.dump(pages_out, f, ensure_ascii=False, indent=2)

    print("\nГотово ✅")
    print(f"  Статей:   {len(articles)}  → {args.out}/articles.json")
    print(f"  Страниц:  {len(pages_out)} → {args.out}/pages.json")
    print(f"  Картинки: {args.out}/images/")
    print(f"  Категории:{len(cats or [])} → {args.out}/categories.json")

if __name__ == "__main__":
    main()
