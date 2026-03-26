/**
 * Scan normalization: EXIF orientation, light enhancement, manual rotation.
 * ML Kit / native document scanner output should pass through without heavy reprocessing
 * (already cropped); this mainly fixes web camera + gallery EXIF bugs.
 */

import exifr from "exifr";

const JPEG_QUALITY = 0.9;
const MAX_EDGE_PX = 2600;

async function canvasToJpegFile(canvas: HTMLCanvasElement, baseName: string): Promise<File> {
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Export JPEG selhal.");
  const safe = baseName.replace(/\.[^.]+$/, "") || "scan-page";
  return new File([blob], `${safe}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/** Fallback when `imageOrientation: from-image` unsupported: common phone EXIF (3,6,8). */
async function bitmapToCanvasViaExif(bitmap: ImageBitmap, file: Blob): Promise<HTMLCanvasElement> {
  let orientation = 1;
  try {
    orientation = (await exifr.orientation(file)) ?? 1;
  } catch {
    orientation = 1;
  }
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D není k dispozici.");

  const swap = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  switch (orientation) {
    case 2:
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6:
      ctx.rotate(0.5 * Math.PI);
      break;
    case 7:
      ctx.rotate(1.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 8:
      ctx.rotate(1.5 * Math.PI);
      break;
    default:
      break;
  }
  ctx.drawImage(bitmap, -w / 2, -h / 2);
  ctx.restore();
  return canvas;
}

async function decodeToCanvas(blob: Blob, fileName: string): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === "undefined") {
    throw new Error("Prohlížeč nepodporuje createImageBitmap.");
  }

  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D není k dispozici.");
      ctx.drawImage(bitmap, 0, 0);
      return canvas;
    } finally {
      bitmap.close();
    }
  } catch {
    const bitmap = await createImageBitmap(blob);
    try {
      return await bitmapToCanvasViaExif(bitmap, blob);
    } finally {
      bitmap.close();
    }
  }
}

/** Mild S-curve contrast (document-ish); skip if canvas tiny. */
function enhanceDocumentContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 32 || h < 32) return canvas;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const boost = y < 0.45 ? 1.08 : y > 0.72 ? 0.94 : 1;
    d[i] = Math.min(255, Math.round(d[i] * boost));
    d[i + 1] = Math.min(255, Math.round(d[i + 1] * boost));
    d[i + 2] = Math.min(255, Math.round(d[i + 2] * boost));
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function downscaleIfNeeded(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const maxE = Math.max(canvas.width, canvas.height);
  if (maxE <= MAX_EDGE_PX) return canvas;
  const scale = MAX_EDGE_PX / maxE;
  const nw = Math.round(canvas.width * scale);
  const nh = Math.round(canvas.height * scale);
  const out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, nw, nh);
  return out;
}

export type NormalizeScanOptions = {
  /** Set false when source is already ML Kit / cleaned (avoid double tone mapping). */
  enhanceContrast?: boolean;
};

/**
 * Flatten EXIF orientation to upright pixels, optional contrast, JPEG output for PDF pipeline.
 */
export async function normalizeScanImageForPdf(file: File, options?: NormalizeScanOptions): Promise<File> {
  const enhance = options?.enhanceContrast !== false;
  let canvas = await decodeToCanvas(file, file.name);
  if (enhance) {
    canvas = enhanceDocumentContrast(canvas);
  }
  canvas = downscaleIfNeeded(canvas);
  return await canvasToJpegFile(canvas, file.name.replace(/\.[^.]+$/, "") || "page");
}

/**
 * Rotate image file 90° clockwise (positive) or counter-clockwise (negative).
 */
export async function rotateScanImageFile(file: File, direction: 1 | -1): Promise<File> {
  const canvas = await decodeToCanvas(file, file.name);
  const w = canvas.width;
  const h = canvas.height;
  const out = document.createElement("canvas");
  out.width = h;
  out.height = w;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D není k dispozici.");
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(direction * 0.5 * Math.PI);
  ctx.drawImage(canvas, -w / 2, -h / 2);
  return await canvasToJpegFile(out, file.name.replace(/\.[^.]+$/, "") || "page");
}

