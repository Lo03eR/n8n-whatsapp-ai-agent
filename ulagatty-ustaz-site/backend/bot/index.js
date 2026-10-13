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
import { Telegraf, Scenes, session, Markup } from "telegraf";

const BOT_TOKEN  = process.env.BOT_TOKEN;
const ADMIN_CHAT = process.env.ADMIN_CHAT_ID || "";
const D_URL      = (process.env.DIRECTUS_URL || "http://directus:8055").replace(/\/+$/, "");
const D_TOKEN    = process.env.DIRECTUS_TOKEN || "";

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
    "ask.name": "Атыңыз-жөніңізді жазыңыз (ФИО):",
    "ask.contact": "Байланыс (телефон немесе @username):",
    "ask.cat": "Санатты таңдаңыз:",
    "ask.title": "Мақала тақырыбын жазыңыз:",
    "ask.text": "Мақала мәтінін жіберіңіз (мәтінмен немесе Word/PDF файлмен):",
    "ask.photo": "Мақала суретін жіберіңіз (міндетті емес).",
    "ask.check": "Соңғы қадам: төлем чегін PDF файл түрінде жіберіңіз 🧾",
    "btn.skip": "⏭ Өткізу",
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
    "ask.name": "Напишите ФИО автора:",
    "ask.contact": "Контакт (телефон или @username):",
    "ask.cat": "Выберите категорию:",
    "ask.title": "Напишите тему статьи:",
    "ask.text": "Пришлите текст статьи (текстом или файлом Word/PDF):",
    "ask.photo": "Пришлите фото к статье (необязательно).",
    "ask.check": "Последний шаг: пришлите чек об оплате PDF-файлом 🧾",
    "btn.skip": "⏭ Пропустить",
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

const mainMenu = (lang) => Markup.keyboard([
  [L[lang]["menu.post"]],
  [L[lang]["menu.myreq"], L[lang]["menu.lang"]],
  [L[lang]["menu.help"]],
]).resize();

const adminMenu = (lang) => Markup.keyboard([
  [L[lang]["menu.post"]],
  [L[lang]["adm.price"], L[lang]["adm.kaspi"]],
  [L[lang]["adm.broadcast"]],
  [L[lang]["menu.myreq"], L[lang]["menu.lang"], L[lang]["menu.help"]],
]).resize();

// ---------- настройки портала (цена, реквизиты Kaspi) ----------
const SETTINGS = "/data/settings.json";
let settings = { price: "1000", kaspi_number: "+7 700 646 4486", kaspi_name: "" };
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
    ctx.reply(t(ctx, "ask.title"), Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply(t(ctx, "v.text"));
    ctx.wizard.state.data.title = ctx.message.text.trim();
    ctx.reply(t(ctx, "ask.text"));
    return ctx.wizard.next();
  },
  (ctx) => {
    const d = ctx.wizard.state.data;
    if (ctx.message?.text) d.body = ctx.message.text.trim();
    else if (ctx.message?.document) {
      d.article_file_id = ctx.message.document.file_id;
      d.article_file_name = ctx.message.document.file_name || "article";
      d.body = ctx.message.caption?.trim() || "(файл)";
    } else return ctx.reply(t(ctx, "v.textfile"));
    ctx.reply(t(ctx, "ask.photo"), Markup.keyboard([[t(ctx, "btn.skip")]]).oneTime().resize());
    return ctx.wizard.next();
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

const stage = new Scenes.Stage([wizard, priceScene, kaspiScene, broadcastScene]);
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
bot.hears(ALL("adm.price"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("setprice"); });
bot.hears(ALL("adm.kaspi"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("setkaspi"); });
bot.hears(ALL("adm.broadcast"), (ctx) => { if (isAdmin(ctx)) ctx.scene.enter("broadcast"); });

// ---------- админ: одобрить/отклонить ----------
bot.action(/^ok:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("Тек әкімшіге / Только админу", { show_alert: true });
  const id = ctx.match[1];
  try {
    const { data: req } = await dFetch(`/items/publish_requests/${id}`);
    await dFetch(`/items/publish_requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
    await dFetch("/items/articles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "published", title: req.title, slug: slugify(req.title),
        content: textToHtml(req.body), categories: req.category ? [req.category] : [],
        author: req.author_name, featured_image: req.photo || null,
        date_published: new Date().toISOString(),
      }),
    });
    await ctx.answerCbQuery("Жарияланды (черновик)");
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || "") + "\n\n✅ ЖАРИЯЛАНДЫ (черновик)");
    if (req.tg_user_id) {
      const l = users[req.tg_user_id]?.lang || "kz";
      ctx.telegram.sendMessage(req.tg_user_id, L[l]["au.approved"]).catch(() => {});
    }
  } catch (e) { console.error(e); await ctx.answerCbQuery("Қате: " + e.message, { show_alert: true }); }
});
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
