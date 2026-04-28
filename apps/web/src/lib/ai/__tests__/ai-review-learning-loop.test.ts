import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ContractReviewRow } from "../review-queue-repository";
import type { DocumentReviewEnvelope } from "../document-review-types";

const txState = {
  updateReturnRows: [{ id: "11111111-1111-4111-8111-111111111111" }],
  selectRows: [] as unknown[],
  inserted: [] as unknown[],
};

vi.mock("@/lib/db/service-db", () => ({
  withServiceTenantContext: async (_options: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => txState.updateReturnRows,
            catch: async () => undefined,
          }),
        }),
      }),
      insert: () => ({
        values: async (values: unknown) => {
          txState.inserted.push(values);
          return undefined;
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => txState.selectRows,
            }),
            limit: async () => txState.selectRows,
            then: (resolve: (value: unknown[]) => void) => resolve(txState.selectRows),
          }),
        }),
      }),
    };
    return fn(tx);
  },
}));

import {
  acceptAiReviewCorrectionEventsOnApproval,
  buildCorrectionEventValues,
  createEvalCaseDraftsForAcceptedCorrections,
  mineLearningPatternDrafts,
  scoreAiReviewEvalCase,
} from "../ai-review-learning";
import {
  runAiReviewLearningValidators,
  validatePremiumAggregation,
  validatePublishEligibility,
} from "../ai-review-learning-validators";
import { buildAiReviewExtractionPromptVariables } from "../ai-review-prompt-variables";

function reviewRow(overrides: Partial<ContractReviewRow> = {}): ContractReviewRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "33333333-3333-4333-8333-333333333333",
    fileName: "uniqa.pdf",
    storagePath: "hash:uniqa-multi",
    mimeType: "application/pdf",
    sizeBytes: 1,
    processingStatus: "review_required",
    processingStage: null,
    errorMessage: null,
    extractedPayload: {},
    clientMatchCandidates: null,
    draftActions: null,
    confidence: 0.7,
    reasonsForReview: [],
    reviewStatus: "pending",
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
    userDeclaredDocumentIntent: null,
    inputMode: "text_pdf",
    extractionMode: "text",
    detectedDocumentType: "life_insurance_contract",
    detectedDocumentSubtype: null,
    lifecycleStatus: "final_contract",
    documentIntent: "creates_new_product",
    extractionTrace: { promptVersion: "prompt-v1", schemaVersion: "schema-v1", aiReviewModel: "model-a", pipelineVersion: "pipeline-v2" },
    validationWarnings: [],
    fieldConfidenceMap: {},
    classificationReasons: [],
    dataCompleteness: null,
    sensitivityProfile: "financial_data",
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
    matchVerdict: null,
    productCategory: null,
    productSubtypes: null,
    extractionConfidence: "medium",
    needsHumanReview: "true",
    missingFields: [],
    proposedAssumptions: {},
    createdAt: new Date("28.04.2026".split(".").reverse().join("-")),
    updatedAt: new Date("28.04.2026".split(".").reverse().join("-")),
    ...overrides,
  };
}

function envelope(overrides: Partial<DocumentReviewEnvelope> = {}): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType: "life_insurance_contract",
      subtype: "life",
      lifecycleStatus: "final_contract",
      documentIntent: "creates_new_product",
      confidence: 0.9,
      reasons: [],
    },
    documentMeta: { scannedVsDigital: "digital" },
    parties: {},
    productsOrObligations: [],
    financialTerms: {},
    serviceTerms: {},
    extractedFields: {
      contractNumber: { value: "UNIQA-1", status: "extracted", confidence: 0.9 },
      institutionName: { value: "UNIQA", status: "extracted", confidence: 0.9 },
      productName: { value: "Životní pojištění", status: "extracted", confidence: 0.9 },
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
    sectionSensitivity: {},
    relationshipInference: {
      policyholderVsInsured: [],
      childInsured: [],
      intermediaryVsClient: [],
      employerVsEmployee: [],
      companyVsPerson: [],
      bankOrLenderVsBorrower: [],
    },
    reviewWarnings: [],
    suggestedActions: [],
    contentFlags: {
      isFinalContract: true,
      isProposalOnly: false,
      containsPaymentInstructions: false,
      containsClientData: true,
      containsAdvisorData: false,
      containsMultipleDocumentSections: false,
    },
    sensitivityProfile: "financial_data",
    ...overrides,
  };
}

beforeEach(() => {
  txState.updateReturnRows = [{ id: "11111111-1111-4111-8111-111111111111" }];
  txState.selectRows = [];
  txState.inserted = [];
});

describe("AI Review learning loop", () => {
  it("builds correction events with metadata from the original review", () => {
    const original = envelope({
      institutionName: undefined,
      productName: undefined,
      premium: { frequency: "monthly", totalMonthlyPremium: 1560, source: "manual_override", calculationBreakdown: [], validationWarnings: [] },
      insuredPersons: [{ order: 1, fullName: "První pojištěný", monthlyPremium: 1560 }],
    });
    const corrected = envelope({
      premium: { frequency: "monthly", totalMonthlyPremium: 2442, source: "sum_of_insured_persons", calculationBreakdown: [], validationWarnings: [] },
      insuredPersons: [
        { order: 1, fullName: "První pojištěný", monthlyPremium: 1560 },
        { order: 2, fullName: "Nikola", monthlyPremium: 882 },
      ],
    });
    const events = buildCorrectionEventValues({
      row: reviewRow({ extractedPayload: original }),
      correctedPayload: corrected,
      correctedFields: ["insuredPersons[1].fullName", "premium.totalMonthlyPremium"],
      correctedBy: "44444444-4444-4444-8444-444444444444",
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      tenantId: "33333333-3333-4333-8333-333333333333",
      institutionName: "UNIQA",
      productName: "Životní pojištění",
      promptVersion: "prompt-v1",
    });
    expect(events[1].correctionType).toBe("wrong_premium_aggregation");
  });

  it("accepts draft correction events on approval", async () => {
    const ids = await acceptAiReviewCorrectionEventsOnApproval({
      tenantId: "33333333-3333-4333-8333-333333333333",
      reviewId: "22222222-2222-4222-8222-222222222222",
    });

    expect(ids).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });

  it("creates eval case draft only for accepted critical corrections", async () => {
    txState.selectRows = [{
      id: "11111111-1111-4111-8111-111111111111",
      reviewId: "22222222-2222-4222-8222-222222222222",
      documentHash: "hash",
      institutionName: "UNIQA",
      productName: "Životní pojištění",
      documentType: "life_insurance_contract",
      fieldPath: "premium.totalMonthlyPremium",
    }];

    const count = await createEvalCaseDraftsForAcceptedCorrections({
      tenantId: "33333333-3333-4333-8333-333333333333",
      reviewId: "22222222-2222-4222-8222-222222222222",
      correctionIds: ["11111111-1111-4111-8111-111111111111"],
      expectedOutput: { premium: { totalMonthlyPremium: 2442 } },
    });

    expect(count).toBe(1);
    expect(txState.inserted[0]).toMatchObject({
      institutionName: "UNIQA",
      piiScrubbed: false,
      active: true,
    });
  });

  it("mines pattern and injects safe prompt hints", () => {
    const patterns = mineLearningPatternDrafts([
      {
        id: "11111111-1111-4111-8111-111111111111",
        institutionName: "UNIQA",
        productName: "Životní pojištění",
        documentType: "life_insurance_contract",
        fieldPath: "premium.totalMonthlyPremium",
        correctionType: "wrong_premium_aggregation",
      },
    ]);
    const promptVars = buildAiReviewExtractionPromptVariables({
      documentText: "UNIQA Životní pojištění",
      classificationReasons: [],
      adobeSignals: "none",
      filename: "uniqa.pdf",
      correctionHints: patterns.map((pattern) => pattern.promptHint).filter((hint): hint is string => Boolean(hint)),
    });

    expect(patterns[0].patternType).toBe("premium_aggregation_rule");
    expect(promptVars.correction_hints).toContain("Known extraction hints from approved advisor corrections");
    expect(promptVars.correction_hints).toContain("Per-insured premium rows must be summed");
  });

  it("validates premium aggregation and publish eligibility", () => {
    const env = envelope({
      insuredPersons: [
        { order: 1, fullName: "První pojištěný", monthlyPremium: 1560 },
        { order: 2, fullName: "Nikola", monthlyPremium: 882 },
      ],
      premium: { frequency: "monthly", totalMonthlyPremium: 1560, source: "manual_override", calculationBreakdown: [], validationWarnings: [] },
    });

    const result = validatePremiumAggregation(
      env,
      "Počet pojištěných: 1 dospělá osoba, 1 dítě\nCelkové běžné měsíční pojistné pro 1. pojištěného 1560\nCelkové běžné měsíční pojistné pro 2. pojištěného 882",
    );
    const publish = validatePublishEligibility({ envelope: result.envelope, uploadIntent: { isModelation: false }, reviewApproved: true });
    const modelationPublish = validatePublishEligibility({ envelope: result.envelope, uploadIntent: { isModelation: true }, reviewApproved: true });

    expect(result.envelope.premium?.totalMonthlyPremium).toBe(2442);
    expect(result.autoFixesApplied).toContain("premium.totalMonthlyPremium=sum_of_insured_persons");
    expect(publish.shouldPublishToCrm).toBe(true);
    expect(modelationPublish.shouldPublishToCrm).toBe(false);
  });

  it("covers UNIQA multi-insured correction loop and eval scorecard", () => {
    const initial = envelope({
      insuredPersons: [{ order: 1, fullName: "První pojištěný", monthlyPremium: 1560 }],
      premium: { frequency: "monthly", totalMonthlyPremium: 1560, source: "manual_override", calculationBreakdown: [], validationWarnings: [] },
    });
    const validation = runAiReviewLearningValidators({
      envelope: initial,
      documentText: "UNIQA Životní pojištění\nPočet pojištěných: 1 dospělá osoba, 1 dítě\n1. pojištěný\n2. pojištěný\nCelkové běžné měsíční pojistné pro 1. pojištěného 1560\nCelkové běžné měsíční pojistné pro 2. pojištěného 882",
      uploadIntent: { isModelation: false },
      reviewApproved: true,
    });
    const corrected = envelope({
      insuredPersons: [
        { order: 1, fullName: "První pojištěný", monthlyPremium: 1560 },
        { order: 2, fullName: "Nikola", monthlyPremium: 882 },
      ],
      premium: { frequency: "monthly", totalMonthlyPremium: 2442, source: "sum_of_insured_persons", calculationBreakdown: [], validationWarnings: [] },
      publishHints: { contractPublishable: true, reviewOnly: false, needsSplit: false, needsManualValidation: false, sensitiveAttachmentOnly: false },
    });
    const patterns = mineLearningPatternDrafts([{
      id: "11111111-1111-4111-8111-111111111111",
      institutionName: "UNIQA",
      productName: "Životní pojištění",
      documentType: "life_insurance_contract",
      fieldPath: "premium.totalMonthlyPremium",
      correctionType: "wrong_premium_aggregation",
    }]);
    const score = scoreAiReviewEvalCase({
      expectedOutput: corrected,
      actualOutput: corrected,
      criticalFields: ["premium.totalMonthlyPremium", "publishHints.contractPublishable"],
    });

    expect(validation.warnings.some((warning) => warning.code === "participant_count_mismatch")).toBe(true);
    expect(patterns[0].promptHint).toContain("Per-insured premium rows must be summed");
    expect(corrected.premium?.totalMonthlyPremium).toBe(2442);
    expect(score.publishDecision).toBe(true);
    expect(score.criticalExact).toBe(1);
  });
});
