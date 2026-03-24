/**
 * Adobe PDF Services facade (Plan 3 §5).
 * Canonical preprocessing contract for downstream AI — not business extraction.
 */

import { getProcessingProvider } from "@/lib/documents/processing/provider";
import { getProcessingConfig } from "@/lib/documents/processing/config";
import type { ProcessingInput, ProcessingOutput } from "@/lib/documents/processing/types";
import { createAdminClient } from "@/lib/supabase/server";
import { createSignedStorageUrl } from "@/lib/storage/signed-url";

export type AdobeServiceError = { code: string; message: string };

export type AdobePageImageRef = { page: number; path: string };

/** Plan 3 §5.3 canonical output (+ ocrConfidenceEstimate §4.4). */
export type AdobeCanonicalPreprocessOutput = {
  ok: boolean;
  normalizedPdfPath?: string;
  extractedText?: string;
  pageImages?: AdobePageImageRef[];
  hasTextLayer?: boolean;
  pageCount?: number | null;
  /** 0–1 heuristic from extracted text length / OCR presence. */
  ocrConfidenceEstimate?: number;
  warnings: string[];
  providerJobIds: string[];
  error?: AdobeServiceError;
};

export type AdobePreprocessDocumentInput = {
  fileUrl: string;
  storagePath: string;
  tenantId: string;
  documentId: string;
  mimeType: string;
  pageCount?: number | null;
  hasTextLayer?: boolean | null;
  /** If true, skip OCR and only run markdown on original (text PDF path). */
  skipOcr?: boolean;
};

async function signedUrlForPath(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { signedUrl } = await createSignedStorageUrl({
    adminClient: admin,
    bucket: "documents",
    path,
    purpose: "internal_processing",
  });
  return signedUrl;
}

/** Map extracted text volume to 0–1 confidence (heuristic). */
export function estimateOcrConfidenceFromText(
  textLength: number,
  hasNormalizedPdf: boolean,
  hasNativeTextLayer?: boolean | null
): number {
  if (hasNativeTextLayer && textLength > 200) return 0.95;
  if (textLength > 2000) return 0.95;
  if (textLength > 500) return 0.82;
  if (textLength > 100) return 0.65;
  if (textLength > 0) return 0.45;
  if (hasNormalizedPdf) return 0.25;
  return 0.15;
}

const PAGE_IMAGES_NOT_IMPLEMENTED = "page_images:not_implemented — Adobe Extract page raster export not wired; use PDF + markdown for AI.";

function baseProcessingInput(
  params: AdobePreprocessDocumentInput,
  fileUrl: string
): ProcessingInput {
  return {
    documentId: params.documentId,
    tenantId: params.tenantId,
    storagePath: params.storagePath,
    mimeType: params.mimeType,
    fileUrl,
    pageCount: params.pageCount ?? null,
    isScanLike: null,
    hasTextLayer: params.hasTextLayer ?? null,
  };
}

/**
 * Full preprocessing: optional OCR then PDF→Markdown text.
 * Plan 3 entry point for AI pipeline.
 */
export async function preprocessDocument(
  params: AdobePreprocessDocumentInput
): Promise<AdobeCanonicalPreprocessOutput> {
  const config = getProcessingConfig();
  const provider = getProcessingProvider();
  const warnings: string[] = [PAGE_IMAGES_NOT_IMPLEMENTED];
  const providerJobIds: string[] = [];

  if (!config.processingEnabled || !provider.isEnabled()) {
    return {
      ok: true,
      warnings: ["Adobe disabled — using original file without server-side OCR/markdown.", ...warnings],
      providerJobIds: [],
      hasTextLayer: params.hasTextLayer ?? undefined,
      pageCount: params.pageCount,
      ocrConfidenceEstimate: estimateOcrConfidenceFromText(0, false, params.hasTextLayer),
    };
  }

  let fileUrl = params.fileUrl;
  let normalizedPdfPath: string | undefined;
  const input = baseProcessingInput(params, fileUrl);

  try {
    const runOcr = !params.skipOcr;
    if (runOcr) {
      const ocrResult: ProcessingOutput = await provider.runOcr(input);
      if (ocrResult.providerJobId) providerJobIds.push(ocrResult.providerJobId);
      if (ocrResult.success && ocrResult.outputPath) {
        normalizedPdfPath = ocrResult.outputPath;
        const nextUrl = await signedUrlForPath(ocrResult.outputPath);
        if (nextUrl) {
          fileUrl = nextUrl;
          input.fileUrl = nextUrl;
        }
      } else if (ocrResult.error) {
        warnings.push(`OCR: ${ocrResult.error}`);
      }
    }

    const mdResult: ProcessingOutput = await provider.runMarkdown(input);
    if (mdResult.providerJobId) providerJobIds.push(mdResult.providerJobId);

    let extractedText: string | undefined;
    if (mdResult.success && mdResult.outputContent) {
      extractedText = mdResult.outputContent;
    } else if (mdResult.error) {
      warnings.push(`Markdown: ${mdResult.error}`);
    }

    const textLen = extractedText?.trim().length ?? 0;
    const ocrConfidenceEstimate = estimateOcrConfidenceFromText(
      textLen,
      Boolean(normalizedPdfPath),
      params.hasTextLayer
    );

    if (textLen === 0 && !normalizedPdfPath) {
      warnings.push("preprocess:no_usable_text_or_ocr_pdf — downstream may use vision fallback.");
    }

    return {
      ok: true,
      normalizedPdfPath,
      extractedText,
      pageImages: [],
      hasTextLayer: params.hasTextLayer ?? undefined,
      pageCount: params.pageCount,
      ocrConfidenceEstimate,
      warnings,
      providerJobIds,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      warnings,
      providerJobIds,
      error: { code: "PREPROCESS_EXCEPTION", message },
    };
  }
}

/** Normalize via OCR only (searchable PDF path in storage). */
export async function normalizePdf(
  params: AdobePreprocessDocumentInput
): Promise<AdobeCanonicalPreprocessOutput> {
  const provider = getProcessingProvider();
  const config = getProcessingConfig();
  const warnings: string[] = [];

  if (!config.processingEnabled || !provider.isEnabled()) {
    return {
      ok: true,
      warnings: ["Adobe disabled — normalizePdf skipped."],
      providerJobIds: [],
    };
  }

  const input = baseProcessingInput(params, params.fileUrl);
  try {
    const ocrResult = await provider.runOcr(input);
    const providerJobIds = ocrResult.providerJobId ? [ocrResult.providerJobId] : [];
    if (ocrResult.success && ocrResult.outputPath) {
      return {
        ok: true,
        normalizedPdfPath: ocrResult.outputPath,
        pageImages: [],
        warnings: [PAGE_IMAGES_NOT_IMPLEMENTED, ...warnings],
        providerJobIds,
        ocrConfidenceEstimate: 0.5,
      };
    }
    return {
      ok: false,
      warnings: ocrResult.error ? [`OCR: ${ocrResult.error}`] : warnings,
      providerJobIds,
      error: { code: "OCR_FAILED", message: ocrResult.error ?? "OCR failed" },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      warnings,
      providerJobIds: [],
      error: { code: "NORMALIZE_EXCEPTION", message },
    };
  }
}

/**
 * Extract text (markdown) and intended page images.
 * Page images are not yet extracted from Adobe ZIP — returns empty array + warning.
 */
export async function extractTextAndImages(
  params: AdobePreprocessDocumentInput
): Promise<AdobeCanonicalPreprocessOutput> {
  const skipOcr = true;
  return preprocessDocument({ ...params, skipOcr });
}

export type DetectScannedInput = {
  markdownTextLength: number;
  mimeType: string | null | undefined;
  hasNativeTextLayer?: boolean | null;
  isScanLike?: boolean | null;
};

/** Heuristic: is this likely a scan / image-heavy document? */
export function detectScannedDocument(input: DetectScannedInput): {
  likelyScanned: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (input.isScanLike) {
    reasons.push("upload flagged as scan-like");
  }
  if (input.mimeType?.startsWith("image/")) {
    reasons.push("image mime type");
  }
  if (input.hasNativeTextLayer === false) {
    reasons.push("no native PDF text layer");
  }
  if (input.markdownTextLength < 80 && input.hasNativeTextLayer !== true) {
    reasons.push("very little text after preprocessing");
  }
  return {
    likelyScanned: reasons.length > 0,
    reasons,
  };
}
