/**
 * Decides whether **contract review** uploads should defer to `scan_pending_ocr` (no LLM extraction).
 *
 * Scope: `contract_upload_reviews` + `runContractReviewProcessing` only. The general `documents` table
 * uses separate upload/processing paths and does not invoke this gate or the AI Review pipeline.
 *
 * Default policy (multimodal-first, 2026-04):
 *   - Text-rich PDFs / native text-layer PDFs pass through.
 *   - PDFs without usable text ALSO pass through — `runContractUnderstandingPipeline` routes to
 *     `createResponseWithFile` multimodal (vision) internally, so deferring here just kept users
 *     stuck on "Čeká na čitelný text" even for documents the LLM could read directly.
 *   - `image/*` mimes are still deferred, because the pipeline entrypoint expects a PDF wrapper.
 *
 * Legacy policy (`AI_REVIEW_FORCE_OCR_GATE=true`) restores the old "defer scan-like PDFs to OCR
 * queue" branch for installations that want the pre-LLM-vision behavior (e.g. where vision cost is
 * a concern and an external OCR pipeline is preferred).
 */

import { detectInputMode } from "@/lib/ai/input-mode-detection";
import type { PreprocessResult } from "@/lib/documents/processing/preprocess-for-ai";

/** Min. délka textu z preprocessu, aby se neskončilo ve `scan_pending_ocr` (sdílené s preprocess fallback). */
export const USABLE_TEXT_MIN = 400;
const USABLE_TEXT_ALT = 200;
const READABILITY_OK = 68;

export type ScanGateResult =
  | { defer: true; reason: string }
  | { defer: false; reason: string };

function isLegacyForceOcrGate(): boolean {
  return (process.env.AI_REVIEW_FORCE_OCR_GATE ?? "").trim().toLowerCase() === "true";
}

/**
 * If preprocess did not yield enough text and the file looks like a scan/image, defer to OCR queue.
 */
export async function evaluateContractReviewScanGate(
  fileUrl: string,
  mimeType: string | null | undefined,
  preprocess: Pick<
    PreprocessResult,
    "markdownContent" | "readabilityScore" | "preprocessStatus" | "preprocessMode"
  >
): Promise<ScanGateResult> {
  const md = preprocess.markdownContent?.trim() ?? "";
  const mime = (mimeType ?? "").toLowerCase();

  if (md.length >= USABLE_TEXT_MIN) {
    return { defer: false, reason: "sufficient_text" };
  }
  if (md.length >= USABLE_TEXT_ALT && (preprocess.readabilityScore ?? 0) >= READABILITY_OK) {
    return { defer: false, reason: "text_with_good_readability" };
  }

  // pdf-parse fallback already proves the file has a text layer — OCR cannot improve it further.
  // Pass any amount of extracted text to the pipeline (file-based LLM will supplement if needed).
  if (preprocess.preprocessMode === "pdf_parse_fallback" && md.length > 0) {
    return { defer: false, reason: "pdf_parse_fallback_has_text" };
  }

  const isPdf = mime.includes("pdf");
  const isImage = mime.startsWith("image/");
  const legacy = isLegacyForceOcrGate();

  // Direct image uploads bypass the pipeline wrapper — still deferred.
  if (isImage) {
    return {
      defer: true,
      reason: legacy ? "image_without_usable_text" : "image_mime_without_pdf_wrapper",
    };
  }

  if (!isPdf) {
    // Word etc. — allow pipeline to try (may fail safely)
    return { defer: false, reason: "non_pdf_non_image" };
  }

  // ── Default (multimodal-first): trust the pipeline's vision fallback ──────
  //
  // For PDFs without usable OCR text we previously called `detectInputMode` (another LLM round-trip)
  // and deferred any non-`text_pdf` result to `scan_pending_ocr`. In practice that created a
  // dead-end UX: Adobe ran for ~50s, returned 0 chars on documents whose native text layer is
  // garbled OCR, and the user stared at "Čeká na čitelný text" for 30 minutes before the watchdog
  // forced them to retry. The `runContractUnderstandingPipeline` already routes to
  // `createResponseWithFile` multimodal when markdown is unavailable, so the LLM can read the
  // scanned pages directly. Passing through is both faster and cheaper than the legacy round-trip.
  if (!legacy) {
    return { defer: false, reason: "multimodal_pdf_pipeline_handles_image_only" };
  }

  // ── Legacy (AI_REVIEW_FORCE_OCR_GATE=true): old detectInputMode branch ────
  try {
    const mode = await detectInputMode(fileUrl, mimeType);
    if (mode.inputMode === "text_pdf") {
      return { defer: false, reason: "text_pdf_detected" };
    }
    return { defer: true, reason: `scan_like_input_${mode.inputMode}` };
  } catch {
    return { defer: true, reason: "detect_input_mode_failed_assume_scan" };
  }
}
