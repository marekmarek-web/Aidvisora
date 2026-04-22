import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateContractReviewScanGate } from "@/lib/contracts/contract-review-scan-gate";

/**
 * Default gate policy: multimodal-first.
 *   - Text-rich PDFs pass through (as before).
 *   - Image-only PDFs pass through WITHOUT detectInputMode round-trip — pipeline routes to
 *     `createResponseWithFile` multimodal internally.
 *   - `image/*` mimes are still deferred because pipeline entry expects PDF.
 * Legacy policy (`AI_REVIEW_FORCE_OCR_GATE=true`) restores the old "defer scan-like PDFs" branch.
 */

const EMPTY_PREPROCESS = {
  markdownContent: "",
  readabilityScore: 0,
  preprocessStatus: "skipped" as const,
  preprocessMode: "none" as const,
};

const TEXT_RICH_PREPROCESS = {
  markdownContent: "x".repeat(1200),
  readabilityScore: 85,
  preprocessStatus: "completed" as const,
  preprocessMode: "adobe" as const,
};

const PDF_PARSE_PREPROCESS = {
  markdownContent: "Parsed PDF text layer content.",
  readabilityScore: 40,
  preprocessStatus: "partial" as const,
  preprocessMode: "pdf_parse_fallback" as const,
};

describe("evaluateContractReviewScanGate — default (multimodal-first)", () => {
  beforeEach(() => {
    vi.stubEnv("AI_REVIEW_FORCE_OCR_GATE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes text-rich PDF through (sufficient_text)", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/contract.pdf",
      "application/pdf",
      TEXT_RICH_PREPROCESS
    );
    expect(r).toEqual({ defer: false, reason: "sufficient_text" });
  });

  it("passes PDF with native text layer (pdf_parse_fallback) through", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/contract.pdf",
      "application/pdf",
      PDF_PARSE_PREPROCESS
    );
    expect(r).toEqual({ defer: false, reason: "pdf_parse_fallback_has_text" });
  });

  it("NO-DEFER for image-only PDF: pipeline handles via multimodal", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/scan.pdf",
      "application/pdf",
      EMPTY_PREPROCESS
    );
    expect(r.defer).toBe(false);
    expect(r.reason).toBe("multimodal_pdf_pipeline_handles_image_only");
  });

  it("NO-DEFER for PDF with short adobe text: pipeline still handles via multimodal", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/scan.pdf",
      "application/pdf",
      { ...EMPTY_PREPROCESS, markdownContent: "a", preprocessMode: "adobe" }
    );
    expect(r.defer).toBe(false);
    expect(r.reason).toBe("multimodal_pdf_pipeline_handles_image_only");
  });

  it("defers direct image/* upload (pipeline entry expects PDF wrapper)", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/scan.jpg",
      "image/jpeg",
      EMPTY_PREPROCESS
    );
    expect(r.defer).toBe(true);
    expect(r.reason).toBe("image_mime_without_pdf_wrapper");
  });

  it("passes non-PDF non-image (docx etc.) through — pipeline may safely fail", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/doc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      EMPTY_PREPROCESS
    );
    expect(r).toEqual({ defer: false, reason: "non_pdf_non_image" });
  });
});

describe("evaluateContractReviewScanGate — legacy (AI_REVIEW_FORCE_OCR_GATE=true)", () => {
  beforeEach(() => {
    vi.stubEnv("AI_REVIEW_FORCE_OCR_GATE", "true");
    // stub detectInputMode to avoid network — we can't inject a mock here because the gate
    // imports it directly, but for the purpose of "defer when legacy is on + image-only PDF",
    // we just need to confirm the gate enters the detectInputMode branch (reason prefix).
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("still passes text-rich PDFs through", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/contract.pdf",
      "application/pdf",
      TEXT_RICH_PREPROCESS
    );
    expect(r).toEqual({ defer: false, reason: "sufficient_text" });
  });

  it("still defers image/* mimes", async () => {
    const r = await evaluateContractReviewScanGate(
      "https://example.com/scan.jpg",
      "image/jpeg",
      EMPTY_PREPROCESS
    );
    expect(r.defer).toBe(true);
    expect(r.reason).toBe("image_without_usable_text");
  });

  // We don't exercise the detectInputMode branch here (requires network / mock of the PDF URL).
  // The legacy branch is a conscious fallback; its behavior is already covered by the old
  // ocr-scan-pending-policy.test.ts flow when AI_REVIEW_FORCE_OCR_GATE is set at runtime.
});
