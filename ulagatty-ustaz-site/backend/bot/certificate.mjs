// ============================================================
//  certificate.mjs — PDF поверх официального ажурного бланка.
//  Три типа в ОДНОМ формате (type): cert | congrat | thanks —
//  различаются только красным заголовком и вводной фразой;
//  шапка, подпись, печать и футер БАҚ — вшиты в бланк.
//  Накладываем: ФИО, тему, место работы, район, ссылку, дату,
//  рег.номер и QR. Шрифт DejaVuSans (казахские буквы), pdf-lib.
// ============================================================
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import { fileURLToPath } from "url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const BLANK = here("./certificate-blank.pdf");
const F_REG = here("./fonts/DejaVuSans.ttf");
const F_BOLD = here("./fonts/DejaVuSans-Bold.ttf");

const BLUE = rgb(0.09, 0.45, 0.82);   // ФИО / тема
const RED  = rgb(0.82, 0.06, 0.06);   // заголовок типа
const MAROON = rgb(0.62, 0.09, 0.11); // как у вшитых подписей-подписей (тёмно-красный)
const DARK = rgb(0.14, 0.14, 0.26);   // значения полей
const WHITE = rgb(1, 1, 1);
const CX = 430; // центр контентной области

// тексты, которые различаются по типам документа.
// cert — заголовок «CERTIFICATE» и вводная строка ВШИТЫ в бланк (ничего не перерисовываем).
// congrat / thanks — перекрываем заголовок и вводную строку и рисуем свои.
const TYPES = {
  cert:    { title: null, intro: null },
  congrat: { title: "ҚҰТТЫҚТАУ", intro: (t) => `«ҰЛАҒАТТЫ ҰСТАЗ.КЗ» ақпаратты порталында «${t}» атты материалыңыздың жарияланғанымен шын жүректен құттықтаймыз!` },
  thanks:  { title: "АЛҒЫС ХАТ",  intro: (t) => `«ҰЛАҒАТТЫ ҰСТАЗ.КЗ» ақпаратты порталында «${t}» атты материалмен бөлісіп, білім саласына қосқан үлесіңіз үшін алғыс білдіреміз.` },
};

export async function makeCertificatePdf(d = {}) {
  const type = TYPES[d.type] ? d.type : "cert";
  const pdf = await PDFDocument.load(fs.readFileSync(BLANK));
  pdf.registerFontkit(fontkit);
  const reg = await pdf.embedFont(fs.readFileSync(F_REG), { subset: true });
  const bold = await pdf.embedFont(fs.readFileSync(F_BOLD), { subset: true });
  const page = pdf.getPages()[0];

  const fit = (font, text, size, maxW) => { let s = size; if (maxW) while (s > 7 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5; return s; };
  const at = (text, x, y, { font = reg, size = 12, color = DARK, maxW = 0 } = {}) =>
    page.drawText(text, { x, y, size: fit(font, text, size, maxW), font, color });
  const center = (text, y, { font = reg, size = 12, color = DARK, maxW = 0 } = {}) => {
    const s = fit(font, text, size, maxW); const w = font.widthOfTextAtSize(text, s);
    page.drawText(text, { x: CX - w / 2, y, size: s, font, color });
  };
  const wrap = (font, text, size, maxW) => {
    const words = String(text).split(/\s+/); const lines = []; let cur = "";
    for (const w of words) { const t = cur ? cur + " " + w : w; if (font.widthOfTextAtSize(t, size) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
    if (cur) lines.push(cur); return lines;
  };
  // посимвольный перенос (для длинных ссылок без пробелов)
  const wrapChars = (font, text, size, maxW) => {
    const out = []; let cur = "";
    for (const ch of String(text)) { const t = cur + ch; if (font.widthOfTextAtSize(t, size) <= maxW || !cur) cur = t; else { out.push(cur); cur = ch; } }
    if (cur) out.push(cur); return out;
  };
  const cover = (x, y, w, h) => page.drawRectangle({ x, y, width: w, height: h, color: WHITE });

  // ----- заголовок типа (для congrat/thanks перекрываем вшитое «CERTIFICATE») -----
  if (TYPES[type].title) {
    cover(150, 450, 560, 50);                        // стереть «CERTIFICATE» (не трогая верхнюю шапку)
    center(TYPES[type].title, 457, { font: bold, size: 47, color: RED, maxW: 600 });
  }

  // ----- ФИО (под заголовком) -----
  if (d.fio) center(String(d.fio).toUpperCase(), 423, { font: bold, size: 24, color: BLUE, maxW: 610 });

  // ----- вводный блок (портал + тема) -----
  // для congrat/thanks перекрываем вшитые 4 строки и рисуем свою вводную фразу вокруг темы
  if (TYPES[type].intro) {
    cover(150, 322, 560, 80);                       // стереть вшитый вводный абзац
    const intro = TYPES[type].intro(String(d.topic || ""));
    let s = 15, lines = wrap(bold, intro, s, 560);
    while (lines.length > 3 && s > 11) { s -= 0.5; lines = wrap(bold, intro, s, 560); }
    const lineH = s * 1.35; const top = 392;
    lines.forEach((ln, i) => center(ln, top - i * lineH, { font: bold, size: s, color: MAROON, maxW: 560 }));
  } else {
    // cert: тема между вшитыми кавычками (стираем пустую строку с кавычками, рисуем свои вокруг темы)
    cover(150, 345, 560, 28);
    const topic = `«${String(d.topic || "")}»`;
    let s = 18, lines = wrap(bold, topic, s, 585);
    while (lines.length > 2 && s > 12) { s -= 0.5; lines = wrap(bold, topic, s, 585); }
    if (lines.length > 1 && s > 15.5) { s = 15.5; lines = wrap(bold, topic, s, 585); }
    const lineH = s * 1.3;
    const yc = lines.length > 1 ? 362 : 356;
    lines.forEach((ln, i) => center(ln, yc - i * lineH, { font: bold, size: s, color: BLUE, maxW: 595 }));
  }

  // ----- поля (значения после вшитых подписей) -----
  if (d.work)   at(String(d.work),   410, 299, { font: bold, size: 12.5, color: DARK, maxW: 410 });
  if (d.region) at(String(d.region), 255, 281, { font: bold, size: 12.5, color: DARK, maxW: 545 });
  if (d.link) {
    const s = 11, url = String(d.link);
    const first = wrapChars(reg, url, s, 308)[0] || url;
    at(first, 480, 258, { size: s, color: BLUE });
    const rest = url.slice(first.length);
    if (rest) wrapChars(reg, rest, s, 548).slice(0, 2).forEach((ln, i) => at(ln, 255, 240 - i * 15, { size: s, color: BLUE }));
  }
  if (d.date)   at(String(d.date), 556, 215, { font: bold, size: 12.5, color: DARK });
  if (d.number) at("№" + String(d.number).replace("-", " - "), 330, 198, { font: bold, size: 12.5, color: DARK });

  if (d.qrPng) { const png = await pdf.embedPng(d.qrPng); page.drawImage(png, { x: 75, y: 444, width: 68, height: 68 }); }

  return Buffer.from(await pdf.save());
}

export function genCertNumber() {
  const n = Math.floor(1000 + Math.random() * 8999999).toString().padStart(7, "0");
  const suf = Math.floor(1 + Math.random() * 98).toString().padStart(2, "0");
  const letter = "ABCDEHKMPT".charAt(Math.floor(Math.random() * 10));
  return "A" + n + "-" + suf + letter;
}
