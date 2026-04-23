/**
 * Wave 2.B regression — verifies that the default `callModel` in
 * `page-image-fallback.ts` dispatches through the legacy OpenAI path when
 * `AI_REVIEW_UNIFIED_INPUT_BUILDER` is unset/off and through the unified
 * multimodal builder when it is set to `"true"`.
 *
 * Only the rasterize path is stubbed via DI — the callModel is exercised as
 * the default so the flag branch actually runs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createResponseStructuredWithImage: vi.fn(),
  createResponseStructuredWithImages: vi.fn(),
  createResponseWithFile: vi.fn(),
  buildUnifiedExtractionCall: vi.fn(),
  unifiedEnabled: { value: false },
}));

vi.mock("@/lib/openai", () => ({
  createResponseStructuredWithImage: mocks.createResponseStructuredWithImage,
  createResponseStructuredWithImages: mocks.createResponseStructuredWithImages,
  createResponseWithFile: mocks.createResponseWithFile,
}));

vi.mock("../unified-multimodal-input", () => ({
  buildUnifiedExtractionCall: mocks.buildUnifiedExtractionCall,
  isUnifiedInputBuilderEnabled: () => mocks.unifiedEnabled.value,
}));

import { runPageImageFallbackForMissingRequired } from "../page-image-fallback";
import type { DocumentReviewEnvelope } from "../document-review-types";

function envelopeMissingRequired(): DocumentReviewEnvelope {
  // life_insurance_contract has many required fields; we leave `policyStartDate`
  // missing and pin sourcePage so rescue picks it up deterministically.
  return {
    documentClassification: {
      primaryType: "life_insurance_contract",
      lifecycleStatus: "final_contract",
      documentIntent: "creates_new_product",
      confidence: 0.8,
      reasons: [],
    },
    documentMeta: { scannedVsDigital: "unknown" },
    parties: {},
    productsOrObligations: [],
    financialTerms: {},
    serviceTerms: {},
    extractedFields: {
      policyStartDate: { status: "missing", sourcePage: 1 },
    },
    evidence: [],
    candidateMatches: {
      matchedClients: [],
      matchedHouseholds: [],
      matchedDeals: [],
      matchedCompanies: [],
      matchedContracts: [],
      score: 0,
      reason: "no_match",
      ambiguityFlags: [],
    },
    reviewWarnings: [],
    suggestedActions: [],
    dataCompleteness: {
      requiredTotal: 0,
      requiredSatisfied: 0,
      optionalExtracted: 0,
      notApplicableCount: 0,
      score: 0,
    },
  } as DocumentReviewEnvelope;
}

describe("page-image-fallback default callModel — AI_REVIEW_UNIFIED_INPUT_BUILDER flag", () => {
  const originalEnv = process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;

  beforeEach(() => {
    mocks.createResponseStructuredWithImage.mockReset();
    mocks.createResponseStructuredWithImages.mockReset();
    mocks.buildUnifiedExtractionCall.mockReset();
    mocks.createResponseStructuredWithImage.mockResolvedValue({
      parsed: { value: "2025-01-01", found: true, confidence: 0.9 },
      text: "{}",
      model: "m",
    });
    mocks.buildUnifiedExtractionCall.mockResolvedValue({
      parsed: { value: "2025-01-01", found: true, confidence: 0.9 },
      rawText: "{}",
      sourceKind: "page_image_fallback",
      evidenceTierForRecoveredFields: "recovered_from_image",
      pagesUsed: 1,
      durationMs: 1,
    });
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;
    else process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = originalEnv;
    mocks.unifiedEnabled.value = false;
  });

  it("flag OFF (default) → legacy createResponseStructuredWithImage is called", async () => {
    mocks.unifiedEnabled.value = false;
    delete process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;

    await runPageImageFallbackForMissingRequired(
      {
        envelope: envelopeMissingRequired(),
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      {
        rasterizePage: async () => ({
          dataUrl: "data:image/png;base64,AAA",
          widthPx: 100,
          heightPx: 100,
        }),
      }
    );

    expect(mocks.createResponseStructuredWithImage).toHaveBeenCalled();
    expect(mocks.buildUnifiedExtractionCall).not.toHaveBeenCalled();
  });

  it("flag ON → buildUnifiedExtractionCall is called with mode 'single_page_rescue'", async () => {
    mocks.unifiedEnabled.value = true;
    process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = "true";

    await runPageImageFallbackForMissingRequired(
      {
        envelope: envelopeMissingRequired(),
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      {
        rasterizePage: async () => ({
          dataUrl: "data:image/png;base64,AAA",
          widthPx: 100,
          heightPx: 100,
        }),
      }
    );

    expect(mocks.buildUnifiedExtractionCall).toHaveBeenCalled();
    const args = mocks.buildUnifiedExtractionCall.mock.calls[0]?.[0] as { mode?: string; imageUrl?: string };
    expect(args?.mode).toBe("single_page_rescue");
    expect(args?.imageUrl).toBe("data:image/png;base64,AAA");
    expect(mocks.createResponseStructuredWithImage).not.toHaveBeenCalled();
  });
});
