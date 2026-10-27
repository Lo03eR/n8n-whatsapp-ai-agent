// ============================================================
//  Telegram-бот «Ұлағатты Ұстаз.kz»
//  Меню с кнопками + выбор языка (ҚАЗ/РУС) + подача статьи с чеком.
//
//  Кнопки меню: 📝 Жариялау/Опубликовать · 📋 Менің өтініштерім/Мои заявки
//               🌐 Тіл/Язык · ℹ️ Көмек/Помощь
//  Язык запоминается для каждого пользователя (/data/users.json).
//
//  Поток подачи: ФИО → контакт → категория → тема → текст(или файл)
//   → фото(необяз.) → чек. Заявка в Directus (publish_requests),
//   файлы в Directus Files, админу — карточка с кнопками одобрить/отклонить.
//
//  Long polling — публичный адрес/вебхук не нужны. ENV см. .env.example.
// ============================================================
import fs from "fs";
import QRCode from "qrcode";
import { Telegraf, Scenes, session, Markup } from "telegraf";
import { makeCertificatePdf, genCertNumber } from "./certificate.mjs";

const BOT_TOKEN  = process.env.BOT_TOKEN;
const ADMIN_CHAT = process.env.ADMIN_CHAT_ID || "5478445096"; // клиент (можно переопределить в .env)
const D_URL      = (process.env.DIRECTUS_URL || "http://directus:8055").replace(/\/+$/, "");
const D_TOKEN    = process.env.DIRECTUS_TOKEN || "";
const SITE_URL   = (process.env.SITE_URL || "https://ulagattyustaz.kz").replace(/\/+$/, "");

if (!BOT_TOKEN) { console.error("Нет BOT_TOKEN в .env"); process.exit(1); }

// категории: храним каноническое (казахское) значение, показываем по языку
const CATS = [
  { kz: "Ұстаз", ru: "Учитель" },
  { kz: "Мектеп тынысы", ru: "Жизнь школы" },
  { kz: "Тәрбие сағаты", ru: "Час воспитания" },
  { kz: "Әдістеме", ru: "Методика" },
];
const catKeyboard = (lang) => CATS.map((c) => [c[lang] || c.kz]);
const canonCat = (text) => { const c = CATS.find((x) => x.kz === text || x.ru === text); return c ? c.kz : null; };

// превратить обычный текст (из Telegram) в безопасный HTML (без тегов пользователя)
const escHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const textToHtml = (s) => escHtml(s).split(/\n{2,}/).map((p) => "<p>" + p.replace(/\n/g, "<br>") + "</p>").join("");

// ---------- тексты (KZ/RU) ----------
const L = {
  kz: {
    "menu.post": "📝 Мақала жариялау",
    "menu.myreq": "📋 Менің өтініштерім",
    "menu.lang": "🌐 Тіл",
    "menu.help": "ℹ️ Көмек",
    start: "Сәлем! Бұл «Ұлағатты Ұстаз.kz» порталының боты 👋\nТөмендегі батырмаларды қолданыңыз.",
    help: "Мақала жариялау үшін «📝 Мақала жариялау» батырмасын басыңыз.\nСізден тақырып, мәтін, сурет және төлем чегі сұралады.\nӘкімші растағаннан кейін мақала сайтта жарияланады.\n\nБатырмалар: 📝 жариялау · 📋 өтініштерім · 🌐 тіл · ℹ️ көмек\n/cancel — толтыруды тоқтату.",
    "lang.choose": "Тілді таңдаңыз:",
    "lang.set": "Тіл: Қазақша ✅",
    "consent": "Өтінішті жібере отырып, сіз дербес деректерді өңдеуге келісесіз: https://ulagattyustaz.kz/privacy.html",
    "ask.name": "Атыңыз-жөніңізді жазыңыз (ФИО):",
    "ask.contact": "Байланыс (телефон немесе @username):",
    "ask.cat": "Санатты таңдаңыз:",
    "ask.work": "Жұмыс орныңызды жазыңыз (мекеме атауы):",
    "ask.region": "Ауданыңыз бен облысыңызды жазыңыз (мыс.: Жетісай ауданы, Түркістан облысы):",
    "ask.title": "Мақала тақырыбын жазыңыз:",
    "ask.text": "Мақала мәтінін жіберіңіз.\nМәтін ұзын болса — бірнеше хабарламамен жіберуге болады (Telegram ұзын мәтінді өзі бөліп жібереді). Барлығын жібергеннен кейін «✅ Дайын» батырмасын басыңыз.\nНемесе Word/PDF файл тіркеңіз.",
    "ask.more": "Қабылдадым ✅ Жалғастыра беріңіз немесе «✅ Дайын» басыңыз.",
    "ask.photo": "Мақала суретін жіберіңіз (міндетті емес).",
    "ask.check": "Соңғы қадам: төлем чегін PDF файл түрінде жіберіңіз 🧾",
    "btn.skip": "⏭ Өткізу",
    "btn.done": "✅ Дайын",
    "v.text": "Мәтінмен жазыңыз, өтінемін.",
    "v.cat": "Батырмалардан санатты таңдаңыз.",
    "v.textfile": "Мәтін немесе файл жіберіңіз.",
    "v.check": "Төлем чегін PDF файл түрінде жіберіңіз.",
    processing: "Қабылдадым, тексеріп жатырмын… ⏳",
    submitted: "Рақмет! Өтінішіңіз қабылданды ✅\nӘкімші тексергеннен кейін хабарласамыз.",
    error: "Қате кетті 😔 Кейінірек қайталаңыз немесе әкімшіге жазыңыз.",
    cancelled: "Болдырылмады.",
    "my.none": "Сізде әзірге өтініш жоқ.",
    "my.head": "Сіздің өтініштеріңіз:",
    st_new: "⏳ тексеруде", st_approved: "✅ мақұлданды", st_rejected: "❌ бас тартылды",
    "au.approved": "Мақалаңыз мақұлданды ✅ Жақында жарияланады. Рақмет!",
    "au.rejected": "Өкінішке орай, мақала жарияланбады. Әкімшіге хабарласыңыз.",
    "adm.price": "💰 Баға", "adm.kaspi": "💳 Kaspi", "adm.broadcast": "📣 Хабарлама",
    "adm.panel": "Әкімші панелі:",
    "adm.askprice": "Жаңа бағаны жазыңыз (теңге), тек сан:",
    "adm.pricesaved": "Баға сақталды ✅",
    "adm.asknum": "Kaspi нөмірін/картасын жазыңыз:",
    "adm.askname": "Kaspi иесінің аты-жөнін жазыңыз:",
    "adm.kaspisaved": "Kaspi деректері сақталды ✅",
    "adm.askbroadcast": "Барлық қолданушыға жіберілетін хабарламаны жазыңыз:",
    "adm.sent": "Жіберілді",
    "adm.only": "Тек әкімшіге.",
    "adm.post": "📥 Материал жариялау",
    "ap.intro": "📥 Материалды жариялау.\nТақырып → санат → мәтін → сурет → құжат.\n/cancel — тоқтату.",
    "ap.name_opt": "Автордың аты-жөні (сертификат үшін). Қажет болмаса «⏭ Өткізу»:",
    "ap.work_opt": "Жұмыс орны (міндетті емес). «⏭ Өткізу» басуға болады:",
    "ap.region_opt": "Аудан, облыс (міндетті емес). «⏭ Өткізу» басуға болады:",
    "ap.doctype": "Қай құжат берілсін?",
    "ap.dt_cert": "📜 Сертификат", "ap.dt_congrat": "🎉 Құттықтау", "ap.dt_thanks": "🙏 Алғыс хат", "ap.dt_none": "🚫 Құжатсыз",
    "ap.published": "✅ Сайтқа жарияланды!\nҚұжат (PDF) сізге жіберілді — оны авторға қайта жолдай аласыз.",
    "ap.pubnodoc": "✅ Сайтқа жарияланды (құжатсыз).",
    "adm.doc": "📜 Құжат жасау",
    "cert.intro": "📜 Құжатты қолмен жасау (мақаласыз).\nФИО → тақырып → тип. /cancel — тоқтату.",
    "cert.fio": "Кімге беріледі? Аты-жөнін жазыңыз:",
    "cert.topic": "Тақырыбын жазыңыз (материал/іс-шара атауы):",
    "cert.done": "Дайын ✅ Құжат (PDF) сізге жіберілді.",
    "adm.ads": "📢 Жарнама",
    "ads.panel": "📢 Сайттағы жарнама",
    "ads.status": "Күйі",
    "ads.on": "✅ Қосулы", "ads.off": "⛔ Өшірулі", "ads.empty": "— бос —",
    "ads.b_edit": "✏️ Өзгерту", "ads.b_on": "✅ Қосу", "ads.b_off": "⛔ Өшіру", "ads.b_del": "🗑 Жою",
    "ads.q_title": "Жарнама тақырыбын жазыңыз (мыс.: ПЛАСТИК ТЕРЕЗЕ ЖӘНЕ ЕСІК):",
    "ads.q_text": "Қысқа сипаттама (мыс.: Сапа · Жылу · Кепілдік):",
    "ads.q_phone": "Телефон (міндетті емес):",
    "ads.q_link": "Сілтеме https://... (міндетті емес):",
    "ads.q_img": "Баннер суретін жіберіңіз (міндетті емес — болмаса мәтінмен көрсетіледі):",
    "ads.saved": "✅ Жарнама сақталды және сайтта қосылды.",
    "ads.on_done": "✅ Жарнама қосылды.", "ads.off_done": "⛔ Жарнама өшірілді.", "ads.del_done": "🗑 Жарнама жойылды.",
  },
  ru: {
    "menu.post": "📝 Опубликовать статью",
    "menu.myreq": "📋 Мои заявки",
    "menu.lang": "🌐 Язык",
    "menu.help": "ℹ️ Помощь",
    start: "Привет! Это бот портала «Ұлағатты Ұстаз.kz» 👋\nПользуйтесь кнопками ниже.",
    help: "Чтобы опубликовать статью, нажмите «📝 Опубликовать статью».\nБот спросит тему, текст, фото и чек об оплате.\nПосле подтверждения администратором статья появится на сайте.\n\nКнопки: 📝 опубликовать · 📋 мои заявки · 🌐 язык · ℹ️ помощь\n/cancel — остановить заполнение.",
    "lang.choose": "Выберите язык:",
    "lang.set": "Язык: Русский ✅",
    "consent": "Отправляя заявку, вы соглашаетесь на обработку персональных данных: https://ulagattyustaz.kz/privacy.html",
    "ask.name": "Напишите ФИО автора:",
    "ask.contact": "Контакт (телефон или @username):",
    "ask.cat": "Выберите категорию:",
    "ask.work": "Укажите место работы (название учреждения):",
    "ask.region": "Укажите район и область (напр.: Жетысайский район, Туркестанская область):",
    "ask.title": "Напишите тему статьи:",
    "ask.text": "Пришлите текст статьи.\nЕсли текст длинный — можно несколькими сообщениями (Telegram сам делит длинный текст на части). Когда отправите всё — нажмите «✅ Готово».\nИли прикрепите файл Word/PDF.",
    "ask.more": "Принял ✅ Продолжайте или нажмите «✅ Готово».",
    "ask.photo": "Пришлите фото к статье (необязательно).",
    "ask.check": "Последний шаг: пришлите чек об оплате PDF-файлом 🧾",
    "btn.skip": "⏭ Пропустить",
    "btn.done": "✅ Готово",
    "v.text": "Напишите, пожалуйста, текстом.",
    "v.cat": "Выберите категорию кнопкой.",
    "v.textfile": "Пришлите текст или файл.",
    "v.check": "Пришлите чек об оплате PDF-файлом.",
    processing: "Принял, проверяю… ⏳",
    submitted: "Спасибо! Заявка принята ✅\nПосле проверки администратором свяжемся с вами.",
    error: "Произошла ошибка 😔 Повторите позже или напишите администратору.",
    cancelled: "Отменено.",
    "my.none": "У вас пока нет заявок.",
    "my.head": "Ваши заявки:",
    st_new: "⏳ на проверке", st_approved: "✅ одобрена", st_rejected: "❌ отклонена",
    "au.approved": "Ваша статья одобрена ✅ Скоро будет опубликована. Спасибо!",
    "au.rejected": "К сожалению, статья не опубликована. Свяжитесь с администратором.",
    "adm.price": "💰 Цена", "adm.kaspi": "💳 Kaspi", "adm.broadcast": "📣 Рассылка",
    "adm.panel": "Панель администратора:",
    "adm.askprice": "Введите новую цену (тенге), только число:",
    "adm.pricesaved": "Цена сохранена ✅",
    "adm.asknum": "Введите номер/карту Kaspi:",
    "adm.askname": "Введите ФИО владельца Kaspi:",
    "adm.kaspisaved": "Реквизиты Kaspi сохранены ✅",
    "adm.askbroadcast": "Введите сообщение для рассылки всем пользователям:",
    "adm.sent": "Отправлено",
    "adm.only": "Только администратору.",
    "adm.post": "📥 Опубликовать материал",
    "ap.intro": "📥 Публикация материала.\nТема → категория → текст → фото → документ.\n/cancel — отмена.",
    "ap.name_opt": "ФИО автора (для сертификата). Не нужно — «⏭ Пропустить»:",
    "ap.work_opt": "Место работы (необязательно). Можно «⏭ Пропустить»:",
    "ap.region_opt": "Район, область (необязательно). Можно «⏭ Пропустить»:",
    "ap.doctype": "Какой документ выдать?",
    "ap.dt_cert": "📜 Сертификат", "ap.dt_congrat": "🎉 Поздравление", "ap.dt_thanks": "🙏 Благодарственное", "ap.dt_none": "🚫 Без документа",
    "ap.published": "✅ Опубликовано на сайте!\nДокумент (PDF) отправлен вам — можете переслать его автору.",
    "ap.pubnodoc": "✅ Опубликовано на сайте (без документа).",
    "adm.doc": "📜 Создать документ",
    "cert.intro": "📜 Создать документ вручную (без статьи).\nФИО → тема → тип. /cancel — отмена.",
    "cert.fio": "Кому выдаём? Введите ФИО:",
    "cert.topic": "Введите тему (название материала/мероприятия):",
    "cert.done": "Готово ✅ Документ (PDF) отправлен вам.",
    "adm.ads": "📢 Реклама",
    "ads.panel": "📢 Реклама на сайте",
    "ads.status": "Статус",
    "ads.on": "✅ Включена", "ads.off": "⛔ Выключена", "ads.empty": "— пусто —",
    "ads.b_edit": "✏️ Изменить", "ads.b_on": "✅ Включить", "ads.b_off": "⛔ Выключить", "ads.b_del": "🗑 Удалить",
    "ads.q_title": "Введите заголовок рекламы (напр.: ПЛАСТИКОВЫЕ ОКНА И ДВЕРИ):",
    "ads.q_text": "Короткое описание (напр.: Качество · Тепло · Гарантия):",
    "ads.q_phone": "Телефон (необязательно):",
    "ads.q_link": "Ссылка https://... (необязательно):",
    "ads.q_img": "Пришлите картинку-баннер (необязательно — без неё покажем текстом):",
    "ads.saved": "✅ Реклама сохранена и включена на сайте.",
    "ads.on_done": "✅ Реклама включена.", "ads.off_done": "⛔ Реклама выключена.", "ads.del_done": "🗑 Реклама удалена.",
  },
};
const ALL = (key) => [L.kz[key], L.ru[key]];

// ---------- хранилище языка (на пользователя) ----------
const DATA = "/data/users.json";
let users = {};
try { users = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch {}
function save() { try { fs.mkdirSync("/data", { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(users)); } catch (e) { console.error(e); } }
const langOf = (ctx) => users[ctx.from.id]?.lang || "kz";
function setLang(ctx, l) { users[ctx.from.id] = { ...(users[ctx.from.id] || {}), lang: l }; save(); }
const t = (ctx, key) => L[langOf(ctx)][key];

// приём длинного текста из нескольких сообщений: кнопка «Готово» и её проверка
const textKb = (ctx) => Markup.keyboard([[t(ctx, "btn.done")]]).resize();
const isTextDone = (ctx) => !!ctx.message?.text && (ctx.message.text === L.kz["btn.done"] || ctx.message.text === L.ru["btn.done"]);

const mainMenu = (lang) => Markup.keyboard([
  [L[lang]["menu.post"]],
  [L[lang]["menu.myreq"], L[lang]["menu.lang"]],
  [L[lang]["menu.help"]],
]).resize();

const adminMenu = (lang) => Markup.keyboard([
  [L[lang]["adm.post"], L[lang]["adm.doc"]],
  [L[lang]["adm.price"], L[lang]["adm.kaspi"]],
  [L[lang]["adm.broadcast"], L[lang]["adm.ads"]],
  [L[lang]["menu.myreq"], L[lang]["menu.lang"], L[lang]["menu.help"]],
]).resize();

// ---------- настройки портала (цена, реквизиты Kaspi) ----------
const SETTINGS = "/data/settings.json";
let settings = { price: "1000", kaspi_number: "87476341495", kaspi_name: "Гүлжаухар Н" };
try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS, "utf8")) }; } catch {}
function saveSettings() { try { fs.mkdirSync("/data", { recursive: true }); fs.writeFileSync(SETTINGS, JSON.stringify(settings)); } catch (e) { console.error(e); } }

function payText(lang) {
  const req = settings.kaspi_name ? ` (${settings.kaspi_name})` : "";
  return lang === "ru"
    ? `Оплатите ${settings.price} ₸ на Kaspi:\n💳 ${settings.kaspi_number}${req}\n\nЗатем пришлите чек об оплате PDF-файлом 🧾`
    : `${settings.price} ₸ төлеңіз. Kaspi:\n💳 ${settings.kaspi_number}${req}\n\nСодан соң төлем чегін PDF файл түрінде жіберіңіз 🧾`;
}

const isAdmin = (ctx) => !!ADMIN_CHAT && String(ctx.from.id) === String(ADMIN_CHAT);
const menuFor = (ctx) => (isAdmin(ctx) ? adminMenu : mainMenu)(langOf(ctx));

// ---------- Directus ----------
async function dFetch(path, opts = {}) {
  const r = await fetch(D_URL + path, { ...opts, headers: { Authorization: `Bearer ${D_TOKEN}`, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`Directus ${r.status}: ${await r.text()}`);
  return r.json();
}
async function uploadTelegramFile(ctx, fileId, filename) {
  const link = await ctx.telegram.getFileLink(fileId);
  const buf = Buffer.from(await (await fetch(link.href)).arrayBuffer());
  const fd = new FormData();
  fd.append("file", new Blob([buf]), filename);
  const j = await fetch(`${D_URL}/files`, { method: "POST", headers: { Authorization: `Bearer ${D_TOKEN}` }, body: fd });
  if (!j.ok) throw new Error(`Directus upload ${j.status}: ${await j.text()}`);
  return (await j.json()).data.id;
}
function slugify(s) {
  const base = (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "st") + "-" + Date.now().toString(36);
}

// ---------- Мастер подачи статьи ----------
const wizard = new Scenes.WizardScene(
  "submit",
  (ctx) => {
    ctx.wizard.state.data = {};
    ctx.reply(t(ctx, "consent"));
    ctx.reply(t(ctx, "ask.name"), Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text"));
    ctx.wizard.state.data.author_name = ctx.message.text.trim();
    ctx.reply(t(ctx, "ask.contact"));
    return ctx.wizard.next();
  },
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text"));
    ctx.wizard.state.data.author_contact = ctx.message.text.trim();
    ctx.reply(t(ctx, "ask.cat"), Markup.keyboard(catKeyboard(langOf(ctx))).oneTime().resize());
    return ctx.wizard.next();
  },
  (ctx) => {
    const canon = canonCat(ctx.message?.text);
    if (!canon) return ctx.reply(t(ctx, "v.cat"));
    ctx.wizard.state.data.category = canon;
    ctx.reply(t(ctx, "ask.work"), Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text"));
    ctx.wizard.state.data.work = ctx.message.text.trim();
    ctx.reply(t(ctx, "ask.region"));
    return ctx.wizard.next();
  },
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text"));
    ctx.wizard.state.data.region = ctx.message.text.trim();
    ctx.reply(t(ctx, "ask.title"));
    return ctx.wizard.next();
  },
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text"));
    ctx.wizard.state.data.title = ctx.message.text.trim();
    ctx.reply(t(ctx, "ask.text"), textKb(ctx));
    return ctx.wizard.next();
  },
  (ctx) => {
    const d = ctx.wizard.state.data;
    // «Готово» — текст собран, идём к фото
    if (isTextDone(ctx)) {
      if (!d.body && !d.article_file_id) return ctx.reply(t(ctx, "v.textfile"), textKb(ctx));
      ctx.reply(t(ctx, "ask.photo"), Markup.keyboard([[t(ctx, "btn.skip")]]).oneTime().resize());
      return ctx.wizard.next();
    }
    // иначе — накапливаем текст из нескольких сообщений (Telegram режет длинный текст)
    if (ctx.message?.text) {
      d.body = (d.body ? d.body + "\n\n" : "") + ctx.message.text.trim();
    } else if (ctx.message?.document) {
      d.article_file_id = ctx.message.document.file_id;
      d.article_file_name = ctx.message.document.file_name || "article";
      if (ctx.message.caption) d.body = (d.body ? d.body + "\n\n" : "") + ctx.message.caption.trim();
    } else return ctx.reply(t(ctx, "v.textfile"), textKb(ctx));
    return ctx.reply(t(ctx, "ask.more"), textKb(ctx)); // остаёмся на шаге, ждём ещё/«Готово»
  },
  (ctx) => {
    const d = ctx.wizard.state.data;
    if (ctx.message?.photo) d.photo_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    ctx.reply(payText(langOf(ctx)), Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  async (ctx) => {
    const d = ctx.wizard.state.data;
    const lang = langOf(ctx);
    // чек принимаем ТОЛЬКО как файл (PDF/документ)
    if (!ctx.message?.document) return ctx.reply(t(ctx, "v.check"));
    d.check_id = ctx.message.document.file_id;
    d.check_name = ctx.message.document.file_name || "check.pdf";
    await ctx.reply(t(ctx, "processing"));
    try {
      const payment_proof = await uploadTelegramFile(ctx, d.check_id, d.check_name);
      let photo = null, article_file = null;
      if (d.photo_id) photo = await uploadTelegramFile(ctx, d.photo_id, "photo.jpg");
      if (d.article_file_id) article_file = await uploadTelegramFile(ctx, d.article_file_id, d.article_file_name);
      const rec = await dFetch("/items/publish_requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "new", author_name: d.author_name, author_contact: d.author_contact,
          category: d.category, title: d.title, body: d.body,
          work: d.work, region: d.region,
          payment_proof, article_file, photo, tg_user_id: String(ctx.from.id),
        }),
      });
      const id = rec.data.id;
      await ctx.reply(t(ctx, "submitted"), menuFor(ctx));
      if (ADMIN_CHAT) {
        const cap = `🆕 Өтініш/Заявка #${id}\n👤 ${d.author_name}\n📞 ${d.author_contact}\n🏷 ${d.category}\n📝 ${d.title}\n\n${(d.body || "").slice(0, 500)}`;
        await ctx.telegram.sendDocument(ADMIN_CHAT, d.check_id, {
          caption: cap,
          ...Markup.inlineKeyboard([
            Markup.button.callback("✅ Жариялау", `ok:${id}`),
            Markup.button.callback("❌ Бас тарту", `no:${id}`),
          ]),
        });
      }
    } catch (e) {
      console.error(e);
      await ctx.reply(t(ctx, "error"), menuFor(ctx));
    }
    return ctx.scene.leave();
  }
);

// ---------- админ-сцены: цена, Kaspi, рассылка ----------
const priceScene = new Scenes.WizardScene("setprice",
  (ctx) => { if (!isAdmin(ctx)) { ctx.reply(t(ctx, "adm.only")); return ctx.scene.leave(); } ctx.reply(t(ctx, "adm.askprice"), Markup.removeKeyboard()); return ctx.wizard.next(); },
  (ctx) => {
    const v = (ctx.message?.text || "").replace(/[^\d]/g, "");
    if (!v) return ctx.reply(t(ctx, "adm.askprice"));
    settings.price = v; saveSettings();
    ctx.reply(t(ctx, "adm.pricesaved") + " (" + v + " ₸)", menuFor(ctx));
    return ctx.scene.leave();
  }
);
const kaspiScene = new Scenes.WizardScene("setkaspi",
  (ctx) => { if (!isAdmin(ctx)) { ctx.reply(t(ctx, "adm.only")); return ctx.scene.leave(); } ctx.reply(t(ctx, "adm.asknum"), Markup.removeKeyboard()); return ctx.wizard.next(); },
  (ctx) => { if (!ctx.message?.text) return ctx.reply(t(ctx, "adm.asknum")); settings.kaspi_number = ctx.message.text.trim(); saveSettings(); ctx.reply(t(ctx, "adm.askname")); return ctx.wizard.next(); },
  (ctx) => { settings.kaspi_name = (ctx.message?.text || "").trim(); saveSettings(); ctx.reply(t(ctx, "adm.kaspisaved"), menuFor(ctx)); return ctx.scene.leave(); }
);
const broadcastScene = new Scenes.WizardScene("broadcast",
  (ctx) => { if (!isAdmin(ctx)) { ctx.reply(t(ctx, "adm.only")); return ctx.scene.leave(); } ctx.reply(t(ctx, "adm.askbroadcast"), Markup.removeKeyboard()); return ctx.wizard.next(); },
  async (ctx) => {
    const msg = ctx.message?.text;
    if (!msg) return ctx.reply(t(ctx, "adm.askbroadcast"));
    const ids = Object.keys(users);
    let sent = 0;
    for (const uid of ids) {
      try { await ctx.telegram.sendMessage(uid, msg); sent++; } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    ctx.reply(t(ctx, "adm.sent") + ": " + sent + "/" + ids.length, menuFor(ctx));
    return ctx.scene.leave();
  }
);

// ---------- админ: ручная публикация материала + выдача документа ----------
const docTypeKb = (lang) => Markup.keyboard([
  [L[lang]["ap.dt_cert"]],
  [L[lang]["ap.dt_congrat"], L[lang]["ap.dt_thanks"]],
  [L[lang]["ap.dt_none"]],
]).oneTime().resize();
const resolveDocType = (text) => {
  const map = { "ap.dt_cert": "cert", "ap.dt_congrat": "congrat", "ap.dt_thanks": "thanks", "ap.dt_none": "none" };
  for (const k in map) if (text === L.kz[k] || text === L.ru[k]) return map[k];
  return null;
};
const skipKb = (ctx) => Markup.keyboard([[t(ctx, "btn.skip")]]).oneTime().resize();
const isSkip = (ctx) => ctx.message?.text && (ctx.message.text === L.kz["btn.skip"] || ctx.message.text === L.ru["btn.skip"]);

// публикация статьи (+ выдача документа при необходимости)
async function adminFinish(ctx, d, lang) {
  await ctx.reply(t(ctx, "processing"), Markup.removeKeyboard());
  let photo = null;
  if (d.photo_id) photo = await uploadTelegramFile(ctx, d.photo_id, "photo.jpg");
  const slug = slugify(d.title);
  await dFetch("/items/articles", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "published", title: d.title, slug, content: textToHtml(d.body),
      categories: d.category ? [d.category] : [], author: d.author_name || "",
      featured_image: photo || null, date_published: new Date().toISOString(),
    }),
  });
  if (!d.type || d.type === "none") { await ctx.reply(t(ctx, "ap.pubnodoc"), menuFor(ctx)); }
  else {
    await issueCertificate({ fio: d.author_name || "", topic: d.title, work: d.work || "", region: d.region || "", slug, type: d.type, target: ctx.from.id, lang });
    await ctx.reply(t(ctx, "ap.published"), menuFor(ctx));
  }
}

// Короткий поток для админа: тема → категория → текст → фото → документ.
// ФИО/место/район спрашиваем только если выдаётся документ, и их можно пропустить.
const adminPostScene = new Scenes.WizardScene("adminpost",
  (ctx) => {
    if (!isAdmin(ctx)) { ctx.reply(t(ctx, "adm.only")); return ctx.scene.leave(); }
    ctx.wizard.state.data = {};
    ctx.reply(t(ctx, "ap.intro"));
    ctx.reply(t(ctx, "ask.title"), Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  (ctx) => { if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text")); ctx.wizard.state.data.title = ctx.message.text.trim(); ctx.reply(t(ctx, "ask.cat"), Markup.keyboard(catKeyboard(langOf(ctx))).oneTime().resize()); return ctx.wizard.next(); },
  (ctx) => { const c = canonCat(ctx.message?.text); if (!c) return ctx.reply(t(ctx, "v.cat")); ctx.wizard.state.data.category = c; ctx.reply(t(ctx, "ask.text"), textKb(ctx)); return ctx.wizard.next(); },
  (ctx) => {
    const d = ctx.wizard.state.data;
    if (isTextDone(ctx)) {
      if (!d.body) return ctx.reply(t(ctx, "v.textfile"), textKb(ctx));
      ctx.reply(t(ctx, "ask.photo"), skipKb(ctx));
      return ctx.wizard.next();
    }
    if (ctx.message?.text) d.body = (d.body ? d.body + "\n\n" : "") + ctx.message.text.trim();
    else if (ctx.message?.document) { if (ctx.message.caption) d.body = (d.body ? d.body + "\n\n" : "") + ctx.message.caption.trim(); else if (!d.body) d.body = d.title; }
    else return ctx.reply(t(ctx, "v.textfile"), textKb(ctx));
    return ctx.reply(t(ctx, "ask.more"), textKb(ctx));
  },
  (ctx) => {
    const d = ctx.wizard.state.data;
    if (ctx.message?.photo) d.photo_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    ctx.reply(t(ctx, "ap.doctype"), docTypeKb(langOf(ctx)));
    return ctx.wizard.next();
  },
  async (ctx) => {
    const d = ctx.wizard.state.data; const lang = langOf(ctx);
    const dt = resolveDocType(ctx.message?.text);
    if (!dt) return ctx.reply(t(ctx, "ap.doctype"), docTypeKb(lang));
    d.type = dt;
    // без документа — публикуем сразу, лишнего не спрашиваем
    if (dt === "none") { try { await adminFinish(ctx, d, lang); } catch (e) { console.error(e); await ctx.reply(t(ctx, "error") + "\n" + e.message, menuFor(ctx)); } return ctx.scene.leave(); }
    // для документа нужны ФИО/место/район — но их можно пропустить
    ctx.reply(t(ctx, "ap.name_opt"), skipKb(ctx));
    return ctx.wizard.next();
  },
  (ctx) => { if (!isSkip(ctx) && ctx.message?.text) ctx.wizard.state.data.author_name = ctx.message.text.trim(); ctx.reply(t(ctx, "ap.work_opt"), skipKb(ctx)); return ctx.wizard.next(); },
  (ctx) => { if (!isSkip(ctx) && ctx.message?.text) ctx.wizard.state.data.work = ctx.message.text.trim(); ctx.reply(t(ctx, "ap.region_opt"), skipKb(ctx)); return ctx.wizard.next(); },
  async (ctx) => {
    const d = ctx.wizard.state.data; const lang = langOf(ctx);
    if (!isSkip(ctx) && ctx.message?.text) d.region = ctx.message.text.trim();
    try { await adminFinish(ctx, d, lang); } catch (e) { console.error(e); await ctx.reply(t(ctx, "error") + "\n" + e.message, menuFor(ctx)); }
    return ctx.scene.leave();
  }
);

// ---------- админ: сделать документ вручную (без статьи) ----------
const certScene = new Scenes.WizardScene("cert",
  (ctx) => {
    if (!isAdmin(ctx)) { ctx.reply(t(ctx, "adm.only")); return ctx.scene.leave(); }
    ctx.wizard.state.data = {};
    ctx.reply(t(ctx, "cert.intro"));
    ctx.reply(t(ctx, "cert.fio"), Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  (ctx) => { if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text")); ctx.wizard.state.data.fio = ctx.message.text.trim(); ctx.reply(t(ctx, "cert.topic")); return ctx.wizard.next(); },
  (ctx) => { if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text")); ctx.wizard.state.data.topic = ctx.message.text.trim(); ctx.reply(t(ctx, "ap.work_opt"), skipKb(ctx)); return ctx.wizard.next(); },
  (ctx) => { if (!isSkip(ctx) && ctx.message?.text) ctx.wizard.state.data.work = ctx.message.text.trim(); ctx.reply(t(ctx, "ap.region_opt"), skipKb(ctx)); return ctx.wizard.next(); },
  (ctx) => { if (!isSkip(ctx) && ctx.message?.text) ctx.wizard.state.data.region = ctx.message.text.trim(); ctx.reply(t(ctx, "ap.doctype"), docTypeKb(langOf(ctx))); return ctx.wizard.next(); },
  async (ctx) => {
    const d = ctx.wizard.state.data; const lang = langOf(ctx);
    const dt = resolveDocType(ctx.message?.text);
    if (!dt || dt === "none") return ctx.reply(t(ctx, "ap.doctype"), docTypeKb(lang));
    await ctx.reply(t(ctx, "processing"), Markup.removeKeyboard());
    try {
      const number = await issueCertificate({ fio: d.fio, topic: d.topic, work: d.work || "", region: d.region || "", slug: "", type: dt, target: ctx.from.id, lang });
      await ctx.reply(t(ctx, "cert.done") + " №" + number, menuFor(ctx));
    } catch (e) { console.error(e); await ctx.reply(t(ctx, "error") + "\n" + e.message, menuFor(ctx)); }
    return ctx.scene.leave();
  }
);

// ---------- админ: управление рекламой (пишем в коллекцию ads в Directus) ----------
async function getAd() { try { const j = await dFetch("/items/ads"); return j.data || {}; } catch { return {}; } }
async function patchAd(data) { return dFetch("/items/ads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); }
async function adPanel(ctx) {
  const ad = await getAd();
  const enabled = ad.enabled !== false;
  const lines = [t(ctx, "ads.panel"), "", t(ctx, "ads.status") + ": " + (enabled ? t(ctx, "ads.on") : t(ctx, "ads.off"))];
  lines.push(ad.title ? ("📌 " + ad.title) : t(ctx, "ads.empty"));
  if (ad.text) lines.push(ad.text);
  if (ad.phone) lines.push("📞 " + ad.phone);
  if (ad.link) lines.push("🔗 " + ad.link);
  if (ad.image) lines.push("🖼 сурет / картинка ✓");
  await ctx.reply(lines.join("\n"), Markup.inlineKeyboard([
    [Markup.button.callback(t(ctx, "ads.b_edit"), "ad:edit")],
    [Markup.button.callback(enabled ? t(ctx, "ads.b_off") : t(ctx, "ads.b_on"), enabled ? "ad:off" : "ad:on")],
    [Markup.button.callback(t(ctx, "ads.b_del"), "ad:del")],
  ]));
}
const adsScene = new Scenes.WizardScene("adsedit",
  (ctx) => { if (!isAdmin(ctx)) { ctx.reply(t(ctx, "adm.only")); return ctx.scene.leave(); } ctx.wizard.state.d = {}; ctx.reply(t(ctx, "ads.q_title"), Markup.removeKeyboard()); return ctx.wizard.next(); },
  (ctx) => { if (!ctx.message?.text) return ctx.reply(t(ctx, "ads.q_title")); ctx.wizard.state.d.title = ctx.message.text.trim(); ctx.reply(t(ctx, "ads.q_text")); return ctx.wizard.next(); },
  (ctx) => { if (!ctx.message?.text) return ctx.reply(t(ctx, "ads.q_text")); ctx.wizard.state.d.text = ctx.message.text.trim(); ctx.reply(t(ctx, "ads.q_phone"), skipKb(ctx)); return ctx.wizard.next(); },
  (ctx) => { if (!isSkip(ctx) && ctx.message?.text) ctx.wizard.state.d.phone = ctx.message.text.trim(); ctx.reply(t(ctx, "ads.q_link"), skipKb(ctx)); return ctx.wizard.next(); },
  (ctx) => { if (!isSkip(ctx) && ctx.message?.text) ctx.wizard.state.d.link = ctx.message.text.trim(); ctx.reply(t(ctx, "ads.q_img"), skipKb(ctx)); return ctx.wizard.next(); },
  async (ctx) => {
    const d = ctx.wizard.state.d;
    await ctx.reply(t(ctx, "processing"), Markup.removeKeyboard());
    try {
      if (ctx.message?.photo) d.image = await uploadTelegramFile(ctx, ctx.message.photo[ctx.message.photo.length - 1].file_id, "ad.jpg");
      await patchAd({ enabled: true, title: d.title, text: d.text || "", phone: d.phone || "", link: d.link || "", ...(d.image ? { image: d.image } : {}) });
      await ctx.reply(t(ctx, "ads.saved"), menuFor(ctx));
      await adPanel(ctx);
    } catch (e) { console.error(e); await ctx.reply(t(ctx, "error") + "\n" + e.message, menuFor(ctx)); }
    return ctx.scene.leave();
  }
);

const stage = new Scenes.Stage([wizard, priceScene, kaspiScene, broadcastScene, adminPostScene, certScene, adsScene]);
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());
bot.use(stage.middleware());

// ---------- команды и меню ----------
bot.start((ctx) => {
  if (!users[ctx.from.id]) setLang(ctx, "kz");
  ctx.reply(t(ctx, "start"), menuFor(ctx));
});
bot.command("menu", (ctx) => ctx.reply(t(ctx, "start"), menuFor(ctx)));
bot.command("post", (ctx) => ctx.scene.enter("submit"));
bot.command("cancel", (ctx) => ctx.scene.leave().then(() => ctx.reply(t(ctx, "cancelled"), menuFor(ctx))));
bot.command("id", (ctx) => ctx.reply(`chat id: ${ctx.chat.id}`));

bot.hears(ALL("menu.post"), (ctx) => ctx.scene.enter("submit"));
bot.hears(ALL("menu.help"), (ctx) => ctx.reply(t(ctx, "help"), menuFor(ctx)));
bot.hears(ALL("menu.lang"), (ctx) =>
  ctx.reply(t(ctx, "lang.choose"), Markup.inlineKeyboard([
    [Markup.button.callback("Қазақша", "lang:kz"), Markup.button.callback("Русский", "lang:ru")],
  ]))
);
bot.action(/^lang:(kz|ru)$/, async (ctx) => {
  setLang(ctx, ctx.match[1]);
  await ctx.answerCbQuery();
  await ctx.reply(t(ctx, "lang.set"), menuFor(ctx));
});

bot.hears(ALL("menu.myreq"), async (ctx) => {
  const lang = langOf(ctx);
  try {
    const { data } = await dFetch(`/items/publish_requests?filter[tg_user_id][_eq]=${ctx.from.id}&sort=-id&limit=10&fields=id,title,status`);
    if (!data.length) return ctx.reply(t(ctx, "my.none"), menuFor(ctx));
    const lines = data.map((r) => `#${r.id} — ${r.title}\n   ${L[lang]["st_" + r.status] || r.status}`);
    ctx.reply(t(ctx, "my.head") + "\n\n" + lines.join("\n"), menuFor(ctx));
  } catch (e) {
    console.error(e);
    ctx.reply(t(ctx, "error"), menuFor(ctx));
  }
});

// ---------- админ: панель и настройки ----------
bot.command("admin", (ctx) => { if (isAdmin(ctx)) ctx.reply(t(ctx, "adm.panel"), adminMenu(langOf(ctx))); });
bot.command("publish", (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("adminpost"); });
bot.command("cert", (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("cert"); });
bot.hears(ALL("adm.post"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("adminpost"); });
bot.hears(ALL("adm.doc"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("cert"); });
bot.command("ads", (ctx) => { if (isAdmin(ctx)) adPanel(ctx); });
bot.hears(ALL("adm.ads"), (ctx) => { if (isAdmin(ctx)) adPanel(ctx); });
bot.action("ad:edit", (ctx) => { if (!isAdmin(ctx)) return ctx.answerCbQuery(t(ctx, "adm.only"), { show_alert: true }); ctx.answerCbQuery(); return ctx.scene.enter("adsedit"); });
bot.action("ad:on",  async (ctx) => { if (!isAdmin(ctx)) return ctx.answerCbQuery(); try { await patchAd({ enabled: true }); } catch (e) { console.error(e); } await ctx.answerCbQuery(t(ctx, "ads.on_done")); return adPanel(ctx); });
bot.action("ad:off", async (ctx) => { if (!isAdmin(ctx)) return ctx.answerCbQuery(); try { await patchAd({ enabled: false }); } catch (e) { console.error(e); } await ctx.answerCbQuery(t(ctx, "ads.off_done")); return adPanel(ctx); });
bot.action("ad:del", async (ctx) => { if (!isAdmin(ctx)) return ctx.answerCbQuery(); try { await patchAd({ enabled: false, title: "", text: "", phone: "", link: "", image: null }); } catch (e) { console.error(e); } await ctx.answerCbQuery(t(ctx, "ads.del_done")); return adPanel(ctx); });
bot.hears(ALL("adm.price"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("setprice"); });
bot.hears(ALL("adm.kaspi"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("setkaspi"); });
bot.hears(ALL("adm.broadcast"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("broadcast"); });

// ---------- админ: одобрить/отклонить ----------
bot.action(/^ok:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("Тек әкімшіге / Только админу", { show_alert: true });
  const id = ctx.match[1];
  try {
    const { data: req } = await dFetch(`/items/publish_requests/${id}`);
    const slug = slugify(req.title);
    await dFetch(`/items/publish_requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
    await dFetch("/items/articles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "published", title: req.title, slug,
        content: textToHtml(req.body), categories: req.category ? [req.category] : [],
        author: req.author_name, featured_image: req.photo || null,
        date_published: new Date().toISOString(),
      }),
    });
    await ctx.answerCbQuery("Жарияланды");
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || "") + "\n\n✅ ЖАРИЯЛАНДЫ");
    if (req.tg_user_id) {
      const l = users[req.tg_user_id]?.lang || "kz";
      ctx.telegram.sendMessage(req.tg_user_id, L[l]["au.approved"]).catch(() => {});
      // выдать сертификат (PDF) автору
      try {
        await issueCertificate({
          fio: req.author_name, topic: req.title, work: req.work, region: req.region,
          slug, type: "cert", target: req.tg_user_id, tgUser: req.tg_user_id, lang: l,
        });
      } catch (e) { console.error("cert error:", e.message); }
    }
  } catch (e) { console.error(e); await ctx.answerCbQuery("Қате: " + e.message, { show_alert: true }); }
});

// гарантированно уникальный номер: проверяем реестр, при совпадении — заново
async function uniqueCertNumber() {
  for (let i = 0; i < 12; i++) {
    const n = genCertNumber();
    try {
      const j = await dFetch(`/items/certificates?filter[number][_eq]=${encodeURIComponent(n)}&fields=id&limit=1`);
      if (!j.data || j.data.length === 0) return n;
    } catch { return n; } // проверка не удалась — отдаём кандидат (unique-констрейнт в БД подстрахует)
  }
  return genCertNumber() + "-" + Date.now().toString(36); // крайний случай
}

// подпись к документу по типу и языку
const DOC_CAPTION = {
  cert:    { kz: "Сертификатыңыз 🎓", ru: "Ваш сертификат 🎓" },
  congrat: { kz: "Құттықтау 🎉",      ru: "Поздравление 🎉" },
  thanks:  { kz: "Алғыс хат 🙏",      ru: "Благодарственное письмо 🙏" },
};

// выдача документа (сертификат/құттықтау/алғыс хат): запись в реестр + PDF поверх бланка.
// target — куда отправить PDF (автору или админу). Возвращает № документа.
async function issueCertificate({ fio, topic, work = "", region = "", slug = "", type = "cert", target, tgUser = null, lang = "kz" }) {
  const t = DOC_CAPTION[type] ? type : "cert";
  const number = await uniqueCertNumber();
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const date = p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() + " жыл.";
  await dFetch("/items/certificates", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number, fio, topic, type: t, tg_user_id: tgUser ? String(tgUser) : null }),
  });
  const verifyUrl = SITE_URL + "/verify.html?n=" + encodeURIComponent(number);
  const articleUrl = slug ? SITE_URL + "/article/" + slug + "/" : SITE_URL;
  const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 300 });
  const pdf = await makeCertificatePdf({ type: t, fio, topic, work, region, link: articleUrl, date, number, qrPng });
  if (target) await bot.telegram.sendDocument(target,
    { source: pdf, filename: t + "-" + number + ".pdf" },
    { caption: (DOC_CAPTION[t][lang] || DOC_CAPTION[t].kz) + "\n№ " + number });
  return number;
}
bot.action(/^no:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("Тек әкімшіге / Только админу", { show_alert: true });
  const id = ctx.match[1];
  try {
    const { data: req } = await dFetch(`/items/publish_requests/${id}`);
    await dFetch(`/items/publish_requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected" }) });
    await ctx.answerCbQuery("Бас тартылды");
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || "") + "\n\n❌ БАС ТАРТЫЛДЫ");
    if (req.tg_user_id) {
      const l = users[req.tg_user_id]?.lang || "kz";
      ctx.telegram.sendMessage(req.tg_user_id, L[l]["au.rejected"]).catch(() => {});
    }
  } catch (e) { console.error(e); await ctx.answerCbQuery("Қате: " + e.message, { show_alert: true }); }
});

bot.launch().then(() => console.log("Бот запущен (long polling)"));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
