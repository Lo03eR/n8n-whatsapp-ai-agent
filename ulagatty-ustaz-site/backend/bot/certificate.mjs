// ============================================================
//  certificate.mjs — генерация PDF-сертификата (без браузера).
//  Дизайн повторяет certificate.html: золотая рамка, красный
//  заголовок, синее ФИО, зелёная тема, дата, рег. номер, QR.
//  Шрифт DejaVuSans — с казахскими буквами.
// ============================================================
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";

// шрифты лежат рядом с модулем (в контейнере /app/fonts, локально ./fonts)
const REG = fileURLToPath(new URL("./fonts/DejaVuSans.ttf", import.meta.url));
const BOLD = fileURLToPath(new URL("./fonts/DejaVuSans-Bold.ttf", import.meta.url));

const TITLES = {
  cert:    { kz: "СЕРТИФИКАТ",  ru: "СЕРТИФИКАТ" },
  grat:    { kz: "АЛҒЫС ХАТ",   ru: "БЛАГОДАРНОСТЬ" },
  holiday: { kz: "ҚҰТТЫҚТАУ",   ru: "ПОЗДРАВЛЕНИЕ" },
};

export function makeCertificatePdf(data) {
  const { type = "cert", fio = "", topic = "", work = "", region = "",
          number = "", date = "", qrPng = null, lang = "kz" } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width, H = doc.page.height;

    // фон + рамки
    doc.rect(0, 0, W, H).fill("#fffdf5");
    doc.lineWidth(7).strokeColor("#d4af37").rect(22, 22, W - 44, H - 44).stroke();
    doc.lineWidth(1.5).strokeColor("#2aa564").rect(33, 33, W - 66, H - 66).stroke();
    // уголки
    doc.fillColor("#d4af37");
    [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]].forEach(([x, y]) => {
      doc.circle(x, y, 5).fill("#d4af37");
    });

    // шапка
    doc.font(BOLD).fontSize(15).fillColor("#2aa564")
      .text("«Ұлағатты Ұстаз.kz»", 0, 58, { align: "center", width: W });
    doc.font(REG).fontSize(10).fillColor("#888")
      .text(lang === "ru" ? "Информационно-образовательный портал" : "Ақпараттық-білім беру порталы",
        0, 80, { align: "center", width: W });

    // заголовок
    const title = (TITLES[type] || TITLES.cert)[lang] || TITLES.cert.kz;
    doc.font(BOLD).fontSize(46).fillColor("#c0392b")
      .text(title, 0, 120, { align: "center", width: W, characterSpacing: 3 });

    // подтверждающая строка
    doc.font(REG).fontSize(13).fillColor("#444")
      .text(lang === "ru" ? "настоящим подтверждается, что материал опубликован:" : "осы куәлік педагогке берілді:",
        0, 188, { align: "center", width: W });

    // ФИО
    doc.font(BOLD).fontSize(30).fillColor("#1b4f8a")
      .text((fio || "").toUpperCase(), 40, 214, { align: "center", width: W - 80 });

    // тема
    if (topic) {
      doc.font(REG).fontSize(15).fillColor("#2aa564")
        .text("«" + topic + "»", 90, 262, { align: "center", width: W - 180 });
    }

    // место работы / регион
    const sub = [work, region].filter(Boolean).join(", ");
    if (sub) {
      doc.font(REG).fontSize(12).fillColor("#555")
        .text(sub, 0, 320, { align: "center", width: W });
    }

    // дата + номер
    doc.font(REG).fontSize(11).fillColor("#333");
    doc.text((lang === "ru" ? "Дата: " : "Күні: ") + date, 70, H - 95);
    doc.text("№ " + number, 70, H - 76);

    // QR
    if (qrPng) {
      doc.image(qrPng, W - 150, H - 158, { width: 92 });
      doc.font(REG).fontSize(8).fillColor("#888")
        .text(lang === "ru" ? "Проверка подлинности" : "Түпнұсқаны тексеру",
          W - 172, H - 60, { width: 136, align: "center" });
    }

    doc.end();
  });
}

export function genCertNumber() {
  const n = Math.floor(1000 + Math.random() * 8999999).toString().padStart(7, "0");
  const suf = Math.floor(1 + Math.random() * 98).toString().padStart(2, "0");
  const letter = "ABCDEHKMPT".charAt(Math.floor(Math.random() * 10));
  return "A" + n + "-" + suf + letter;   // без пробелов — удобно для URL/QR
}
