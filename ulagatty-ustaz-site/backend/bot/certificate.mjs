// ============================================================
//  certificate.mjs — PDF-сертификат поверх официального бланка
//  (certificate-blank.pdf). Накладываем только переменные поля:
//  ФИО, тема, место работы, район, ссылка, дата, рег. номер, QR.
//  Вензеля, «CERTIFICATE», подпись, печать и футер БАҚ — на бланке.
//  Шрифт DejaVuSans (казахские буквы), наложение через pdf-lib.
// ============================================================
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import { fileURLToPath } from "url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const BLANK = here("./certificate-blank.pdf");
const F_REG = here("./fonts/DejaVuSans.ttf");
const F_BOLD = here("./fonts/DejaVuSans-Bold.ttf");

const BLUE = rgb(0.09, 0.45, 0.82), NAVY = rgb(0.10, 0.14, 0.38), DARK = rgb(0.15, 0.15, 0.28), LINK = rgb(0.10, 0.40, 0.85);
const CX = 420; // центр контентной области бланка

export async function makeCertificatePdf(d = {}) {
  const pdf = await PDFDocument.load(fs.readFileSync(BLANK));
  pdf.registerFontkit(fontkit);
  const reg = await pdf.embedFont(fs.readFileSync(F_REG), { subset: true });
  const bold = await pdf.embedFont(fs.readFileSync(F_BOLD), { subset: true });
  const page = pdf.getPages()[0];

  const fit = (font, text, size, maxW) => { let s = size; if (maxW) while (s > 8 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5; return s; };
  const center = (text, y, { font = reg, size = 12, color = DARK, maxW = 0 } = {}) => {
    const s = fit(font, text, size, maxW); const w = font.widthOfTextAtSize(text, s);
    page.drawText(text, { x: CX - w / 2, y, size: s, font, color });
  };
  const at = (text, x, y, { font = reg, size = 12, color = DARK, maxW = 0 } = {}) =>
    page.drawText(text, { x, y, size: fit(font, text, size, maxW), font, color });

  if (d.fio)    center(String(d.fio).toUpperCase(), 412, { font: bold, size: 22, color: BLUE, maxW: 560 });
  if (d.topic)  center(String(d.topic), 349, { font: bold, size: 13, color: NAVY, maxW: 380 });
  if (d.work)   at(String(d.work), 220, 290, { size: 12, maxW: 430 });
  if (d.region) at(String(d.region), 125, 272, { size: 12, maxW: 520 });
  if (d.link)   at(String(d.link), 275, 248, { size: 11, color: LINK, maxW: 450 });
  if (d.date)   at(String(d.date), 415, 205, { size: 12 });
  if (d.number) at("№ " + d.number, 222, 189, { font: bold, size: 12, color: DARK });

  if (d.qrPng) { const png = await pdf.embedPng(d.qrPng); page.drawImage(png, { x: 75, y: 444, width: 68, height: 68 }); }

  return Buffer.from(await pdf.save());
}

export function genCertNumber() {
  const n = Math.floor(1000 + Math.random() * 8999999).toString().padStart(7, "0");
  const suf = Math.floor(1 + Math.random() * 98).toString().padStart(2, "0");
  const letter = "ABCDEHKMPT".charAt(Math.floor(Math.random() * 10));
  return "A" + n + "-" + suf + letter;
}
