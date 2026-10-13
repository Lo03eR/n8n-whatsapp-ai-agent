// ============================================================
//  Telegram-бот «Ұлағатты Ұстаз.kz» — приём статьи + чека.
//
//  Поток: автор присылает ФИО → контакт → категорию → тему →
//  текст (или файл) → фото (необяз.) → чек об оплате.
//  Заявка сохраняется в Directus (коллекция publish_requests),
//  файлы заливаются в Directus Files, админу приходит карточка
//  с кнопками «Опубликовать / Отклонить».
//  По «Опубликовать» создаётся черновик статьи в коллекции articles.
//
//  Работает через long polling — публичный адрес/вебхук НЕ нужен.
//  Переменные окружения — в .env (см. .env.example).
// ============================================================
import { Telegraf, Scenes, session, Markup } from "telegraf";

const BOT_TOKEN   = process.env.BOT_TOKEN;
const ADMIN_CHAT  = process.env.ADMIN_CHAT_ID || "";
const D_URL       = (process.env.DIRECTUS_URL || "http://directus:8055").replace(/\/+$/, "");
const D_TOKEN     = process.env.DIRECTUS_TOKEN || "";
const SITE_URL    = (process.env.SITE_URL || "").replace(/\/+$/, "");

if (!BOT_TOKEN) { console.error("Нет BOT_TOKEN в .env"); process.exit(1); }

const CATS = ["Ұстаз", "Мектеп тынысы", "Тәрбие сағаты", "Әдістеме"];

// ---------- Directus helpers ----------
async function dFetch(path, opts = {}) {
  const r = await fetch(D_URL + path, {
    ...opts,
    headers: { Authorization: `Bearer ${D_TOKEN}`, ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Directus ${r.status}: ${await r.text()}`);
  return r.json();
}

async function uploadTelegramFile(ctx, fileId, filename) {
  const link = await ctx.telegram.getFileLink(fileId);           // прямая ссылка на файл в Telegram
  const resp = await fetch(link.href);
  const buf  = Buffer.from(await resp.arrayBuffer());
  const fd   = new FormData();
  fd.append("file", new Blob([buf]), filename);
  const j = await fetch(`${D_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${D_TOKEN}` },
    body: fd,
  });
  if (!j.ok) throw new Error(`Directus upload ${j.status}: ${await j.text()}`);
  return (await j.json()).data.id;
}

function slugify(s) {
  const base = (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "st") + "-" + Date.now().toString(36);
}

// ---------- Мастер заявки (wizard) ----------
const wizard = new Scenes.WizardScene(
  "submit",
  // 0. старт
  (ctx) => {
    ctx.wizard.state.data = {};
    ctx.reply("Атыңыз-жөніңізді жазыңыз (ФИО автора):",
      Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  // 1. ФИО -> контакт
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply("Мәтінмен жазыңыз, өтінемін.");
    ctx.wizard.state.data.author_name = ctx.message.text.trim();
    ctx.reply("Байланыс (телефон немесе @username):");
    return ctx.wizard.next();
  },
  // 2. контакт -> категория
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply("Мәтінмен жазыңыз, өтінемін.");
    ctx.wizard.state.data.author_contact = ctx.message.text.trim();
    ctx.reply("Санатты таңдаңыз:",
      Markup.keyboard(CATS.map((c) => [c])).oneTime().resize());
    return ctx.wizard.next();
  },
  // 3. категория -> тема
  (ctx) => {
    const t = ctx.message?.text;
    if (!CATS.includes(t)) return ctx.reply("Батырмалардан санатты таңдаңыз.");
    ctx.wizard.state.data.category = t;
    ctx.reply("Мақала тақырыбын жазыңыз:", Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  // 4. тема -> текст/файл
  (ctx) => {
    if (!ctx.message?.text) return ctx.reply("Тақырыпты мәтінмен жазыңыз.");
    ctx.wizard.state.data.title = ctx.message.text.trim();
    ctx.reply("Мақала мәтінін жіберіңіз (мәтінмен немесе Word/PDF файлмен):");
    return ctx.wizard.next();
  },
  // 5. текст/файл -> фото статьи
  async (ctx) => {
    const d = ctx.wizard.state.data;
    if (ctx.message?.text) {
      d.body = ctx.message.text.trim();
    } else if (ctx.message?.document) {
      d.article_file_id = ctx.message.document.file_id;
      d.article_file_name = ctx.message.document.file_name || "article";
      d.body = ctx.message.caption?.trim() || "(мәтін файлмен жіберілді)";
    } else {
      return ctx.reply("Мәтін немесе файл жіберіңіз.");
    }
    ctx.reply("Мақала суретін жіберіңіз (міндетті емес).",
      Markup.keyboard([["⏭ Өткізу"]]).oneTime().resize());
    return ctx.wizard.next();
  },
  // 6. фото статьи -> чек
  (ctx) => {
    const d = ctx.wizard.state.data;
    if (ctx.message?.photo) {
      d.photo_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    } // «⏭ Өткізу» или любой текст — пропускаем
    ctx.reply("Соңғы қадам: төлем чегін сурет түрінде жіберіңіз 🧾",
      Markup.removeKeyboard());
    return ctx.wizard.next();
  },
  // 7. чек -> сохранить
  async (ctx) => {
    const d = ctx.wizard.state.data;
    if (!ctx.message?.photo) return ctx.reply("Төлем чегін СУРЕТ түрінде жіберіңіз.");
    d.check_id = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    await ctx.reply("Қабылдадым, тексеріп жатырмын… ⏳");
    try {
      const payment_proof = await uploadTelegramFile(ctx, d.check_id, "check.jpg");
      let photo = null, article_file = null;
      if (d.photo_id)        photo = await uploadTelegramFile(ctx, d.photo_id, "photo.jpg");
      if (d.article_file_id) article_file = await uploadTelegramFile(ctx, d.article_file_id, d.article_file_name);

      const rec = await dFetch("/items/publish_requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "new",
          author_name: d.author_name,
          author_contact: d.author_contact,
          category: d.category,
          title: d.title,
          body: d.body,
          payment_proof,
          article_file,
          tg_user_id: String(ctx.from.id),
        }),
      });
      const id = rec.data.id;

      await ctx.reply("Рақмет! Өтінішіңіз қабылданды ✅\nӘкімші тексергеннен кейін хабарласамыз.");

      // карточка админу
      if (ADMIN_CHAT) {
        const caption =
          `🆕 Жаңа өтініш #${id}\n` +
          `👤 ${d.author_name}\n📞 ${d.author_contact}\n` +
          `🏷 ${d.category}\n📝 ${d.title}\n\n` +
          `${(d.body || "").slice(0, 500)}`;
        await ctx.telegram.sendPhoto(ADMIN_CHAT, d.check_id, {
          caption,
          ...Markup.inlineKeyboard([
            Markup.button.callback("✅ Жариялау", `ok:${id}`),
            Markup.button.callback("❌ Бас тарту", `no:${id}`),
          ]),
        });
      }
    } catch (e) {
      console.error(e);
      await ctx.reply("Қате кетті 😔 Кейінірек қайталап көріңіз немесе әкімшіге жазыңыз.");
    }
    return ctx.scene.leave();
  }
);

const stage = new Scenes.Stage([wizard]);

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) =>
  ctx.reply(
    "Сәлем! Бұл «Ұлағатты Ұстаз.kz» порталының боты.\n\n" +
    "Мақала жариялау үшін /post деп жазыңыз.\n" +
    "Мен тақырып, мәтін, сурет пен төлем чегін сұраймын, содан соң әкімшіге жіберемін."
  )
);
bot.command("post", (ctx) => ctx.scene.enter("submit"));
bot.command("cancel", (ctx) => ctx.scene.leave().then(() => ctx.reply("Болдырылмады.", Markup.removeKeyboard())));
// узнать свой chat id (для ADMIN_CHAT_ID)
bot.command("id", (ctx) => ctx.reply(`Сіздің chat id: ${ctx.chat.id}`));

// ---------- Админ: одобрить / отклонить ----------
bot.action(/^ok:(\d+)$/, async (ctx) => {
  const id = ctx.match[1];
  try {
    const { data: req } = await dFetch(`/items/publish_requests/${id}`);
    await dFetch(`/items/publish_requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    // создаём черновик статьи
    await dFetch("/items/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "draft",
        title: req.title,
        slug: slugify(req.title),
        content: req.body,
        categories: req.category ? [req.category] : [],
        author: req.author_name,
        featured_image: req.article_file ? null : null,
        date_published: new Date().toISOString(),
      }),
    });
    await ctx.answerCbQuery("Жарияланды (черновик жасалды)");
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || "") + "\n\n✅ ЖАРИЯЛАНДЫ (черновик)");
    if (req.tg_user_id) {
      await ctx.telegram.sendMessage(req.tg_user_id,
        `Мақалаңыз мақұлданды ✅ Жақында жарияланады. Рақмет!`).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCbQuery("Қате: " + e.message, { show_alert: true });
  }
});

bot.action(/^no:(\d+)$/, async (ctx) => {
  const id = ctx.match[1];
  try {
    const { data: req } = await dFetch(`/items/publish_requests/${id}`);
    await dFetch(`/items/publish_requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    await ctx.answerCbQuery("Бас тартылды");
    await ctx.editMessageCaption((ctx.callbackQuery.message.caption || "") + "\n\n❌ БАС ТАРТЫЛДЫ");
    if (req.tg_user_id) {
      await ctx.telegram.sendMessage(req.tg_user_id,
        `Өкінішке орай, мақала жарияланбады. Әкімшіге хабарласыңыз.`).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCbQuery("Қате: " + e.message, { show_alert: true });
  }
});

bot.launch().then(() => console.log("Бот запущен (long polling)"));
process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
