import { describe, it, expect } from "vitest";
import { tryInferInputModeFromPreprocess } from "@/lib/ai/ai-review-pipeline-v2";
import type { PipelinePreprocessMeta } from "@/lib/ai/contract-understanding-pipeline";

/**
 * Guards Pilíř 2 of the "AI Review scan reading fix":
 *   - PDFs with garbled OCR text layers must NOT be shortcut to `text_pdf`.
 *   - detectInputMode must be allowed to run (we return null here).
 *   - Clean native-text PDFs are still shortcut to avoid one OpenAI round-trip.
 */

const CLEAN_PDF_PARSE: PipelinePreprocessMeta = {
  preprocessMode: "pdf_parse_fallback",
  preprocessStatus: "partial",
  readabilityScore: 78,
  ocrConfidenceEstimate: 0.9,
  pageCountEstimate: 6,
  textQualityScore: 0.82,
  textQualityIsGarbage: false,
  textQualityReasons: [],
};

const GARBAGE_PDF_PARSE: PipelinePreprocessMeta = {
  preprocessMode: "pdf_parse_fallback_garbage",
  preprocessStatus: "partial",
  readabilityScore: 35,
  ocrConfidenceEstimate: 0.35,
  pageCountEstimate: 6,
  textQualityScore: 0.28,
  textQualityIsGarbage: true,
  textQualityReasons: ["digit_in_word_high", "low_stopwords", "suspicious_case_runs"],
};

const LOW_SCORE_BUT_NOT_FLAGGED: PipelinePreprocessMeta = {
  preprocessMode: "pdf_parse_fallback",
  preprocessStatus: "partial",
  readabilityScore: 45,
  ocrConfidenceEstimate: 0.6,
  pageCountEstimate: 6,
  textQualityScore: 0.42, // < 0.5 threshold — treated as garbage-ish
  textQualityIsGarbage: false,
  textQualityReasons: [],
};

describe("tryInferInputModeFromPreprocess — garbage guard (Pilíř 2)", () => {
  it("shortcuts clean pdf_parse_fallback to text_pdf", () => {
    const r = tryInferInputModeFromPreprocess(CLEAN_PDF_PARSE, 1500);
    expect(r).not.toBeNull();
    expect(r?.inputMode).toBe("text_pdf");
    expect(r?.extractionMode).toBe("text");
    expect(r?.extractionWarnings).toContain("input_mode_inferred_from_pdf_parse_fallback");
  });

  it("does NOT shortcut garbled pdf_parse_fallback (textQualityIsGarbage=true)", () => {
    const r = tryInferInputModeFromPreprocess(GARBAGE_PDF_PARSE, 1500);
    expect(r).toBeNull();
  });

  it("does NOT shortcut when preprocessMode is pdf_parse_fallback_garbage", () => {
    const r = tryInferInputModeFromPreprocess(
      { ...CLEAN_PDF_PARSE, preprocessMode: "pdf_parse_fallback_garbage" },
      1500
    );
    expect(r).toBeNull();
  });

  it("does NOT shortcut when textQualityScore is below 0.5", () => {
    const r = tryInferInputModeFromPreprocess(LOW_SCORE_BUT_NOT_FLAGGED, 1500);
    expect(r).toBeNull();
  });

  it("returns null for empty hint even when text layer is clean", () => {
    expect(tryInferInputModeFromPreprocess(CLEAN_PDF_PARSE, 0)).toBeNull();
  });

  it("returns null for null meta", () => {
    expect(tryInferInputModeFromPreprocess(null, 1500)).toBeNull();
    expect(tryInferInputModeFromPreprocess(undefined, 1500)).toBeNull();
  });
});
