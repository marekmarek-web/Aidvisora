import { describe, expect, it } from "vitest";
import { buildPipelineInsightsFromReviewRow } from "../pipeline-review-insights";
import type { ContractReviewRow } from "../review-queue-repository";

function reviewRow(partial: Partial<ContractReviewRow>): ContractReviewRow {
  return {
    id: "r1",
    tenantId: "t1",
    fileName: "x.pdf",
    storagePath: "p",
    mimeType: "application/pdf",
    sizeBytes: 100,
    processingStatus: "extracted",
    errorMessage: null,
    extractedPayload: null,
    clientMatchCandidates: null,
    draftActions: null,
    confidence: null,
    reasonsForReview: null,
    reviewStatus: null,
    uploadedBy: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    appliedBy: null,
    appliedAt: null,
    matchedClientId: null,
    createNewClientConfirmed: null,
    applyResultPayload: null,
    reviewDecisionReason: null,
    inputMode: "text_pdf",
    extractionMode: "openai",
    detectedDocumentType: null,
    detectedDocumentSubtype: null,
    lifecycleStatus: null,
    documentIntent: null,
    extractionTrace: null,
    validationWarnings: null,
    fieldConfidenceMap: null,
    classificationReasons: null,
    dataCompleteness: null,
    sensitivityProfile: null,
    sectionSensitivity: null,
    relationshipInference: null,
    originalExtractedPayload: null,
    correctedPayload: null,
    correctedFields: null,
    correctedDocumentType: null,
    correctedLifecycleStatus: null,
    fieldMarkedNotApplicable: null,
    linkedClientOverride: null,
    linkedDealOverride: null,
    confidenceOverride: null,
    ignoredWarnings: null,
    correctionReason: null,
    correctedBy: null,
    correctedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("buildPipelineInsightsFromReviewRow", () => {
  it("maps extraction trace and safe payment preview from extractedPayload.debug", () => {
    const insights = buildPipelineInsightsFromReviewRow(
      reviewRow({
        detectedDocumentType: "payment_instructions",
        extractedPayload: {
          debug: {
            paymentInstructionExtraction: {
              institutionName: "ACME",
              iban: "CZ6508000000192000145399",
              amount: "1000",
              currency: "CZK",
              needsHumanReview: false,
            },
          },
        },
        extractionTrace: {
          rawClassification: "payment_instructions",
          normalizedPipelineClassification: "payment_instructions",
          classificationConfidence: 0.9,
          extractionRoute: "payment_instructions",
          preprocessMode: "adobe",
          preprocessStatus: "ok",
          adobeWarnings: [],
          textCoverageEstimate: 0.95,
        },
      }),
    );
    expect(insights.normalizedPipelineClassification).toBe("payment_instructions");
    expect(insights.extractionRoute).toBe("payment_instructions");
    expect(insights.rawClassification).toBe("payment_instructions");
    expect(insights.paymentPreview?.institutionName).toBe("ACME");
    expect(insights.paymentPreview?.ibanHint).toMatch(/…5399$/);
  });
});
