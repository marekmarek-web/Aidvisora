import { describe, expect, it } from "vitest";
import {
  buildCorrectionRecord,
  aggregateCorrectionAnalytics,
  type CorrectionRecord,
} from "../correction-analytics";
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
    extractedPayload: { contractNumber: "C-002", institutionName: "Allianz" },
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
    },
    validationWarnings: null,
    fieldConfidenceMap: null,
    classificationReasons: null,
    dataCompleteness: null,
    sensitivityProfile: null,
    sectionSensitivity: null,
    relationshipInference: null,
    originalExtractedPayload: { contractNumber: "C-001", institutionName: "Allianz" },
    correctedPayload: { contractNumber: "C-002", institutionName: "Allianz" },
    correctedFields: ["contractNumber"],
    correctedDocumentType: null,
    correctedLifecycleStatus: null,
    fieldMarkedNotApplicable: null,
    linkedClientOverride: null,
    linkedDealOverride: null,
    confidenceOverride: null,
    ignoredWarnings: null,
    correctionReason: "typo fix",
    correctedBy: "u1",
    correctedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe("buildCorrectionRecord", () => {
  it("builds a record when original and corrected differ", () => {
    const record = buildCorrectionRecord(baseRow());
    expect(record).not.toBeNull();
    expect(record!.reviewId).toBe("r1");
    expect(record!.comparison.changedFields).toContain("contractNumber");
    expect(record!.documentType).toBe("insurance_contract");
    expect(record!.institutionName).toBe("Allianz");
  });

  it("returns null when no original payload", () => {
    const record = buildCorrectionRecord(baseRow({ originalExtractedPayload: null }));
    expect(record).toBeNull();
  });

  it("returns null when payloads are identical", () => {
    const same = { contractNumber: "C-001" };
    const record = buildCorrectionRecord(
      baseRow({ originalExtractedPayload: same, correctedPayload: same }),
    );
    expect(record).toBeNull();
  });
});

describe("aggregateCorrectionAnalytics", () => {
  it("aggregates multiple correction records", () => {
    const records: CorrectionRecord[] = [
      {
        reviewId: "r1",
        tenantId: "t1",
        documentType: "insurance_contract",
        normalizedClassification: "insurance_contract",
        inputMode: "text_pdf",
        extractionRoute: "contract_intake",
        institutionName: "Allianz",
        correctedFields: ["contractNumber"],
        correctedBy: "u1",
        correctedAt: new Date(),
        correctionReason: null,
        comparison: {
          changedFields: ["contractNumber"],
          delta: { contractNumber: { from: "C-001", to: "C-002" } },
          addedInCorrection: [],
          removedInCorrection: [],
        },
        pipelineVersion: null,
      },
      {
        reviewId: "r2",
        tenantId: "t1",
        documentType: "payment_instructions",
        normalizedClassification: "payment_instructions",
        inputMode: "scanned_pdf",
        extractionRoute: "payment_instructions",
        institutionName: "CSOB",
        correctedFields: ["amount", "iban"],
        correctedBy: "u1",
        correctedAt: new Date(),
        correctionReason: null,
        comparison: {
          changedFields: ["amount", "iban"],
          delta: {
            amount: { from: "100", to: "200" },
            iban: { from: null, to: "CZ1234" },
          },
          addedInCorrection: ["iban"],
          removedInCorrection: [],
        },
        pipelineVersion: null,
      },
    ];

    const summary = aggregateCorrectionAnalytics(records);
    expect(summary.totalCorrections).toBe(2);
    expect(summary.averageCorrectedFieldsPerReview).toBe(1.5);
    expect(summary.correctionsByDocumentType.insurance_contract).toBe(1);
    expect(summary.correctionsByDocumentType.payment_instructions).toBe(1);
    expect(summary.correctionsByInputMode.text_pdf).toBe(1);
    expect(summary.correctionsByInputMode.scanned_pdf).toBe(1);
    expect(summary.topCorrectedFields.length).toBeGreaterThan(0);
    expect(summary.topCorrectedFields[0].count).toBe(1);
  });

  it("handles empty array", () => {
    const summary = aggregateCorrectionAnalytics([]);
    expect(summary.totalCorrections).toBe(0);
    expect(summary.averageCorrectedFieldsPerReview).toBe(0);
  });
});
