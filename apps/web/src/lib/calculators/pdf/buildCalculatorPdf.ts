import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import type { CalculatorPdfSection } from "./types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const FOOTER_MIN = 52;

function wrapLineToWidth(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          const t = chunk + ch;
          if (font.widthOfTextAtSize(t, size) <= maxWidth) chunk = t;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        line = chunk;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface BuildCalculatorPdfOptions {
  documentTitle: string;
  sections: CalculatorPdfSection[];
  disclaimerLines: readonly string[];
  /** Defaults to `/fonts/NotoSans-Regular.ttf` (Next.js public). */
  fontRegularUrl?: string;
  fontBoldUrl?: string;
}

/**
 * Build a multi-page A4 PDF from section/row data. Intended for client-side use (fetch fonts from same origin).
 */
export async function buildCalculatorPdf(options: BuildCalculatorPdfOptions): Promise<Uint8Array> {
  const regUrl = options.fontRegularUrl ?? "/fonts/NotoSans-Regular.ttf";
  const boldUrl = options.fontBoldUrl ?? "/fonts/NotoSans-Bold.ttf";

  const [regBytes, boldBytes] = await Promise.all([
    fetch(regUrl).then((r) => {
      if (!r.ok) throw new Error(`Font load failed: ${regUrl}`);
      return r.arrayBuffer();
    }),
    fetch(boldUrl).then((r) => {
      if (!r.ok) throw new Error(`Font load failed: ${boldUrl}`);
      return r.arrayBuffer();
    }),
  ]);

  const doc = await PDFDocument.create();
  doc.setTitle(options.documentTitle);
  doc.setProducer("Aidvisora");
  doc.setCreationDate(new Date());

  const fontReg = await doc.embedFont(regBytes, { subset: true });
  const fontBold = await doc.embedFont(boldBytes, { subset: true });

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = page.getHeight() - MARGIN;
  const maxTextWidth = PAGE_W - 2 * MARGIN;
  const mainTitleSize = 14;
  const sectionTitleSize = 11;
  const bodySize = 10;
  const smallSize = 9;
  const lineStepBody = 14;
  const lineStepSmall = 12;

  const ensureSpace = (nextLineDrop: number) => {
    if (y - nextLineDrop < FOOTER_MIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = page.getHeight() - MARGIN;
    }
  };

  ensureSpace(lineStepBody);
  page.drawText(options.documentTitle, {
    x: MARGIN,
    y,
    size: mainTitleSize,
    font: fontBold,
    color: rgb(0.05, 0.12, 0.31),
  });
  y -= mainTitleSize + 10;

  const generated = `Vygenerováno: ${new Date().toLocaleString("cs-CZ")}`;
  ensureSpace(lineStepSmall);
  page.drawText(generated, {
    x: MARGIN,
    y,
    size: smallSize,
    font: fontReg,
    color: rgb(0.42, 0.45, 0.5),
  });
  y -= lineStepSmall + 8;

  for (const section of options.sections) {
    ensureSpace(lineStepBody);
    page.drawText(section.title, {
      x: MARGIN,
      y,
      size: sectionTitleSize,
      font: fontBold,
      color: rgb(0.07, 0.16, 0.35),
    });
    y -= sectionTitleSize + 8;

    for (const row of section.rows) {
      const line = `${row.label}: ${row.value}`;
      const wrapped = wrapLineToWidth(line, maxTextWidth, fontReg, bodySize);
      for (const wline of wrapped) {
        ensureSpace(lineStepBody);
        page.drawText(wline, {
          x: MARGIN,
          y,
          size: bodySize,
          font: fontReg,
          color: rgb(0.18, 0.2, 0.23),
        });
        y -= lineStepBody;
      }
    }
    y -= 8;
  }

  ensureSpace(lineStepBody);
  page.drawText("Důležité upozornění", {
    x: MARGIN,
    y,
    size: sectionTitleSize,
    font: fontBold,
    color: rgb(0.28, 0.3, 0.33),
  });
  y -= sectionTitleSize + 8;

  for (const disc of options.disclaimerLines) {
    const wrapped = wrapLineToWidth(disc, maxTextWidth, fontReg, smallSize);
    for (const wline of wrapped) {
      ensureSpace(lineStepSmall);
      page.drawText(wline, {
        x: MARGIN,
        y,
        size: smallSize,
        font: fontReg,
        color: rgb(0.38, 0.4, 0.44),
      });
      y -= lineStepSmall;
    }
  }

  return doc.save();
}
