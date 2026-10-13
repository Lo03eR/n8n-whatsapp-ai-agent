# Коллекции Directus для портала

После установки зайди в админку (`/admin`) и создай коллекции ниже
(**Settings → Data Model → Create Collection**). Это разовая настройка.

## 1. Коллекция `articles` (статьи)

| Поле             | Тип в Directus            | Назначение                              |
|------------------|---------------------------|-----------------------------------------|
| `id`             | (создаётся авто)          | идентификатор                           |
| `status`         | Dropdown (`draft`/`published`/`archived`) | показываем только `published` |
| `title`          | Input (String)            | заголовок                               |
| `slug`           | Input (String), unique    | адрес статьи (`article.html?slug=`)     |
| `date_published` | Datetime                  | дата публикации                         |
| `categories`     | Tags                      | категории (Ұстаз / Мектеп тынысы / …)   |
| `content`        | WYSIWYG (Rich Text / HTML)| текст статьи                            |
| `featured_image` | Image (File)              | обложка                                 |
| `author`         | Input (String)            | автор (ФИО)                             |

> Поля `title`, `slug`, `content` — обязательные. В `categories` вводи те же
> названия, что и на сайте: **Ұстаз, Мектеп тынысы, Тәрбие сағаты, Әдістеме**
> (распределение по разделам — в `js/content.js`, объект `CAT_RULES`).

## 2. Коллекция `publish_requests` (заявки на публикацию)

Сюда падают заявки с формы `publish.html` и из Telegram-бота.

| Поле             | Тип                        | Назначение                         |
|------------------|----------------------------|------------------------------------|
| `status`         | Dropdown (`new`/`approved`/`rejected`) | этап модерации        |
| `author_name`    | Input                      | кто прислал                        |
| `author_contact` | Input                      | телефон/телеграм для связи         |
| `category`       | Dropdown                   | категория                          |
| `title`          | Input                      | тема статьи                        |
| `body`           | Textarea / WYSIWYG         | текст статьи                       |
| `article_file`   | File                       | файл статьи (если прислали файлом)  |
| `payment_proof`  | Image (File)               | чек об оплате                      |
| `created_at`     | Datetime (по умолчанию now)| когда пришла                       |

Поток: заявка `new` → админ смотрит чек → жмёт «Одобрить» → бот/он создаёт
запись в `articles` со `status=published` и меняет заявку на `approved`.

## 3. Доступ для сайта (публичное чтение статей)

Чтобы статический сайт мог читать статьи без логина:

**Settings → Access Policies → Public** → у коллекции `articles` включи
право **Read** и добавь фильтр `status = published`.
Поля `publish_requests` оставь закрытыми (туда пишет только форма/бот через
отдельный токен). Картинки (`Directus Files`) — тоже дай Public **Read**,
иначе обложки не покажутся.

## Проверка API

После настройки эти ссылки должны отдавать JSON:
```
https://api.ulagattyustaz.kz/items/articles?filter[status][_eq]=published&limit=1
https://api.ulagattyustaz.kz/server/health
```
