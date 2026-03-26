import { PDFDocument } from "pdf-lib";

/**
 * E2E scan pipeline (historický problém):
 * capture → useScanCapture (File[]) → buildPdfFromImages → preview → upload.
 * Dříve: pevná A4 + centrování + scale≤1 ⇒ „fotka na bílém“.
 * Nyní: vstupní stránky jsou už normalizované (orientace) v useScanCapture;
 * PDF má page box podle obrázku + malý okraj (žádný velký bílý mat).
 */

const MARGIN_PT = 4.5;

async function embedRasterPage(
  pdfDoc: PDFDocument,
  pageFile: File
): Promise<Awaited<ReturnType<PDFDocument["embedPng"]>>> {
  const bytes = new Uint8Array(await pageFile.arrayBuffer());
  const mime = (pageFile.type || "").toLowerCase();

  if (mime === "image/png") {
    return pdfDoc.embedPng(bytes);
  }
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return pdfDoc.embedJpg(bytes);
  }

  if (typeof createImageBitmap === "undefined") {
    throw new Error(
      "Tento typ obrázku nelze v prohlížeči vložit do PDF. Uložte prosím jako JPG nebo PNG, nebo použijte mobilní aplikaci."
    );
  }

  const bitmap = await createImageBitmap(pageFile);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas není k dispozici.");
    }
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) {
      throw new Error("Konverze obrázku do PDF selhala.");
    }
    const jpegBytes = new Uint8Array(await blob.arrayBuffer());
    return pdfDoc.embedJpg(jpegBytes);
  } finally {
    bitmap.close();
  }
}

/**
 * Build multipage PDF: each page tightly wraps the image (minimal margin).
 * Expects each `File` to already be normalized (JPEG) from `normalizeScanImageForPdf`.
 */
export async function buildPdfFromImages(
  pages: File[],
  options?: { documentName?: string }
): Promise<File> {
  if (pages.length === 0) {
    throw new Error("No pages to build from.");
  }

  const pdfDoc = await PDFDocument.create();

  if (options?.documentName) {
    pdfDoc.setTitle(options.documentName);
  }
  pdfDoc.setProducer("Aidvisora Scanner");
  pdfDoc.setCreationDate(new Date());

  for (const pageFile of pages) {
    const image = await embedRasterPage(pdfDoc, pageFile);
    const { width: imgW, height: imgH } = image.scale(1);

    const pageW = imgW + 2 * MARGIN_PT;
    const pageH = imgH + 2 * MARGIN_PT;

    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(image, {
      x: MARGIN_PT,
      y: MARGIN_PT,
      width: imgW,
      height: imgH,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const timestamp = Date.now();
  const safeName = (options?.documentName ?? "scan").replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${safeName}-${timestamp}.pdf`;

  return new File([new Uint8Array(pdfBytes)], fileName, {
    type: "application/pdf",
    lastModified: timestamp,
  });
}
