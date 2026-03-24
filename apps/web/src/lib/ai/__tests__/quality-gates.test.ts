import { describe, expect, it } from "vitest";
import {
  evaluateApplyReadiness,
  evaluatePaymentApplyReadiness,
  type ApplyGateResult,
} from "../quality-gates";
import type { ContractReviewRow } from "../review-queue-repository";

function baseRow(partial: Partial<ContractReviewRow> = {}): ContractReviewRow {
  return {
    id: "r1",
    tenantId: "t1",
    fileName: "test.pdf",
    storagePath: "/p",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    processingStatus: "extracted",
    errorMessage: null,
    extractedPayload: null,
    clientMatchCandidates: null,
    draftActions: null,
    confidence: 0.9,
    reasonsForReview: null,
    reviewStatus: "approved",
    uploadedBy: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectReason: null,
    appliedBy: null,
    appliedAt: null,
    matchedClientId: "c1",
    createNewClientConfirmed: null,
    applyResultPayload: null,
    reviewDecisionReason: null,
    inputMode: "text_pdf",
    extractionMode: "openai",
    detectedDocumentType: "insurance_contract",
    detectedDocumentSubtype: null,
    lifecycleStatus: "final_contract",
    documentIntent: null,
    extractionTrace: {
      classificationConfidence: 0.92,
      extractionRoute: "contract_intake",
      normalizedPipelineClassification: "insurance_contract",
      preprocessStatus: "ok",
      textCoverageEstimate: 0.95,
    },
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

describe("evaluateApplyReadiness", () => {
  it("returns ready_for_apply for a clean high-confidence contract", () => {
    const result = evaluateApplyReadiness(baseRow());
    expect(result.readiness).toBe("ready_for_apply");
    expect(result.blockedReasons).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("blocks proposals/modelations", () => {
    const result = evaluateApplyReadiness(
      baseRow({ detectedDocumentType: "insurance_proposal" }),
    );
    expect(result.readiness).toBe("blocked_for_apply");
    expect(result.blockedReasons).toContain("PROPOSAL_NOT_FINAL");
  });

  it("blocks unsupported document types", () => {
    const result = evaluateApplyReadiness(
      baseRow({ detectedDocumentType: "unknown" }),
    );
    expect(result.readiness).toBe("blocked_for_apply");
    expect(result.blockedReasons).toContain("UNSUPPORTED_DOCUMENT_TYPE");
  });

  it("blocks on low classification confidence", () => {
    const result = evaluateApplyReadiness(
      baseRow({
        extractionTrace: {
          classificationConfidence: 0.3,
          extractionRoute: "contract_intake",
          normalizedPipelineClassification: "insurance_contract",
        },
      }),
    );
    expect(result.readiness).toBe("blocked_for_apply");
    expect(result.blockedReasons).toContain("LOW_CLASSIFICATION_CONFIDENCE");
  });

  it("warns on low text coverage", () => {
    const result = evaluateApplyReadiness(
      baseRow({
        extractionTrace: {
          classificationConfidence: 0.9,
          textCoverageEstimate: 0.15,
          extractionRoute: "contract_intake",
          normalizedPipelineClassification: "insurance_contract",
        },
      }),
    );
    expect(result.readiness).toBe("review_required");
    expect(result.warnings).toContain("LOW_TEXT_COVERAGE");
  });

  it("warns on preprocess failure", () => {
    const result = evaluateApplyReadiness(
      baseRow({
        extractionTrace: {
          classificationConfidence: 0.9,
          preprocessStatus: "failed",
          extractionRoute: "contract_intake",
          normalizedPipelineClassification: "insurance_contract",
        },
      }),
    );
    expect(result.warnings).toContain("PREPROCESS_FAILED");
  });

  it("blocks on ambiguous client match", () => {
    const result = evaluateApplyReadiness(
      baseRow({
        matchedClientId: null,
        createNewClientConfirmed: null,
        clientMatchCandidates: [{ id: "a" }, { id: "b" }],
      }),
    );
    expect(result.readiness).toBe("blocked_for_apply");
    expect(result.blockedReasons).toContain("AMBIGUOUS_CLIENT_MATCH");
  });

  it("blocks on pipeline failedStep", () => {
    const result = evaluateApplyReadiness(
      baseRow({
        extractionTrace: {
          classificationConfidence: 0.9,
          failedStep: "structured_extraction",
          extractionRoute: "contract_intake",
          normalizedPipelineClassification: "insurance_contract",
        },
      }),
    );
    expect(result.blockedReasons).toContain("PIPELINE_FAILED_STEP");
  });

  it("checks payment gates for payment_instructions route", () => {
    const result = evaluateApplyReadiness(
      baseRow({
        detectedDocumentType: "payment_instructions",
        extractionTrace: {
          classificationConfidence: 0.9,
          extractionRoute: "payment_instructions",
          normalizedPipelineClassification: "payment_instructions",
        },
        extractedPayload: {
          debug: {
            paymentInstructionExtraction: {
              amount: "500",
              iban: "CZ6508000000192000145399",
              paymentFrequency: "monthly",
              variableSymbol: "123456",
              institutionName: "ACME",
            },
          },
        },
      }),
    );
    expect(result.readiness).toBe("ready_for_apply");
  });
});

describe("evaluatePaymentApplyReadiness", () => {
  it("returns ready_for_apply for complete payment", () => {
    const result = evaluatePaymentApplyReadiness({
      amount: "500",
      iban: "CZ6508000000192000145399",
      paymentFrequency: "monthly",
      variableSymbol: "123456",
      institutionName: "ACME",
    });
    expect(result.readiness).toBe("ready_for_apply");
    expect(result.blockedReasons).toEqual([]);
  });

  it("blocks when amount is missing", () => {
    const result = evaluatePaymentApplyReadiness({
      iban: "CZ6508000000192000145399",
      paymentFrequency: "monthly",
      variableSymbol: "123456",
    });
    expect(result.readiness).toBe("blocked_for_apply");
    expect(result.blockedReasons).toContain("PAYMENT_MISSING_AMOUNT");
  });

  it("blocks when payment target is missing", () => {
    const result = evaluatePaymentApplyReadiness({
      amount: "500",
      paymentFrequency: "monthly",
      variableSymbol: "123456",
    });
    expect(result.readiness).toBe("blocked_for_apply");
    expect(result.blockedReasons).toContain("PAYMENT_MISSING_TARGET");
  });

  it("warns when frequency is missing", () => {
    const result = evaluatePaymentApplyReadiness({
      amount: "500",
      iban: "CZ6508000000192000145399",
      variableSymbol: "123456",
    });
    expect(result.readiness).toBe("review_required");
    expect(result.warnings).toContain("PAYMENT_MISSING_FREQUENCY");
  });

  it("warns when identifier is missing", () => {
    const result = evaluatePaymentApplyReadiness({
      amount: "500",
      iban: "CZ6508000000192000145399",
      paymentFrequency: "monthly",
    });
    expect(result.warnings).toContain("PAYMENT_MISSING_IDENTIFIER");
  });

  it("accepts domestic account + bankCode as payment target", () => {
    const result = evaluatePaymentApplyReadiness({
      amount: "500",
      accountNumber: "123456/0300",
      bankCode: "0300",
      paymentFrequency: "monthly",
      variableSymbol: "999",
      institutionName: "Bank",
    });
    expect(result.readiness).toBe("ready_for_apply");
  });

  it("warns on low confidence", () => {
    const result = evaluatePaymentApplyReadiness({
      amount: "500",
      iban: "CZ1234",
      paymentFrequency: "monthly",
      variableSymbol: "123",
      institutionName: "X",
      confidence: 0.3,
    });
    expect(result.warnings).toContain("PAYMENT_LOW_CONFIDENCE");
  });
});
