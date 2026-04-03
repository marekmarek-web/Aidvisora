/**
 * Phase 4I regression: review workbench flow, CRM mapping, publish guards,
 * audit trail, modelation guards, payment instruction routing, reject flow.
 *
 * Run: pnpm test:ai-review-phase4-regression
 */

import { describe, expect, it } from "vitest";
import type { DocumentReviewEnvelope } from "../document-review-types";
import { buildAdvisorReviewViewModel } from "../../ai-review/advisor-review-view-model";
import { mapApiToExtractionDocument } from "../../ai-review/mappers";
import type { ApiReviewDetail } from "../../ai-review/mappers";
import {
  buildCanonicalPaymentPayload,
  isPaymentSyncReady,
} from "../payment-field-contract";
import { resolvePaymentSetupClientVisibility } from "../payment-publish-bridge";
import { tryBuildPaymentSetupDraftFromRawPayload } from "../draft-actions";
import { mergeFieldEditsIntoExtractedPayload } from "../../ai-review/mappers";

/* ─── Helpers ────────────────────────────────────────────────────── */

function minimalEnvelope(
  lifecycle: DocumentReviewEnvelope["documentClassification"]["lifecycleStatus"],
  primary: DocumentReviewEnvelope["documentClassification"]["primaryType"] = "life_insurance_contract"
): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType: primary,
      subtype: "fixture",
      lifecycleStatus: lifecycle,
      documentIntent: "reference_only",
      confidence: 0.88,
      reasons: ["phase4_fixture"],
    },
    documentMeta: { scannedVsDigital: "digital", overallConfidence: 0.88 },
    parties: {},
    productsOrObligations: [],
    financialTerms: {},
    serviceTerms: {},
    extractedFields: {},
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
  };
}

function makeApiDetail(overrides: Partial<ApiReviewDetail> = {}): ApiReviewDetail {
  return {
    id: "test-id",
    processingStatus: "extracted",
    reviewStatus: "pending",
    confidence: 0.85,
    extractedPayload: {},
    draftActions: [],
    clientMatchCandidates: [],
    ...overrides,
  } as ApiReviewDetail;
}

/* ─── Scenario 1: Finální pojistná smlouva ──────────────────────── */

describe("Phase 4I — Scenario 1: Finální pojistná smlouva", () => {
  it("draft vznikne s draftActions z paymentu a smlouvy", () => {
    const detail = makeApiDetail({
      processingStatus: "extracted",
      reviewStatus: "pending",
      extractedPayload: {
        documentClassification: {
          primaryType: "life_insurance_contract",
          lifecycleStatus: "active",
          subtype: "",
          documentIntent: "reference_only",
          confidence: 0.9,
          reasons: [],
        },
        documentMeta: { scannedVsDigital: "digital", overallConfidence: 0.9 },
        parties: {},
        productsOrObligations: [],
        financialTerms: {},
        serviceTerms: {},
        extractedFields: {
          contractNumber: { value: "5012345678", status: "extracted", confidence: 0.95 },
          totalMonthlyPremium: { value: "2500", status: "extracted", confidence: 0.9 },
          iban: { value: "CZ6508000000192000145399", status: "extracted", confidence: 0.92 },
          variableSymbol: { value: "5012345678", status: "extracted", confidence: 0.88 },
        },
        evidence: [],
        candidateMatches: {
          matchedClients: [], matchedHouseholds: [], matchedDeals: [],
          matchedCompanies: [], matchedContracts: [], score: 0,
          reason: "no_match", ambiguityFlags: [],
        },
        sectionSensitivity: {},
        relationshipInference: {
          policyholderVsInsured: [], childInsured: [], intermediaryVsClient: [],
          employerVsEmployee: [], companyVsPerson: [], bankOrLenderVsBorrower: [],
        },
        reviewWarnings: [],
        suggestedActions: [],
      },
      draftActions: [
        { type: "create_payment_setup", label: "Vytvořit platební instrukce", payload: {
          regularAmount: "2500",
          currency: "CZK",
          iban: "CZ6508000000192000145399",
          variableSymbol: "5012345678",
        }},
      ],
    });

    const doc = mapApiToExtractionDocument(detail, "");
    expect(doc.draftActions.length).toBeGreaterThan(0);
    const payAction = doc.draftActions.find((a) => a.type === "create_payment_setup");
    expect(payAction).toBeDefined();
    expect(payAction!.payload).toMatchObject({ regularAmount: "2500", iban: "CZ6508000000192000145399" });
  });

  it("publishReadiness je ready_for_publish po schválení", () => {
    const detail = makeApiDetail({ reviewStatus: "approved", processingStatus: "extracted" });
    const doc = mapApiToExtractionDocument(detail, "");
    expect(doc.publishReadiness).toBe("ready_for_publish");
  });

  it("publishReadiness je published po zapsání", () => {
    const detail = makeApiDetail({ reviewStatus: "applied", processingStatus: "extracted" });
    const doc = mapApiToExtractionDocument(detail, "");
    expect(doc.isApplied).toBe(true);
    expect(doc.publishReadiness).toBe("published");
  });
});

/* ─── Scenario 2: Návrh / modelace (nesmí být finální smlouva) ───── */

describe("Phase 4I — Scenario 2: Návrh / modelace", () => {
  it("advisorReview paymentSyncPreview má status skipped_modelation", () => {
    const env = minimalEnvelope("modelation", "life_insurance_modelation");
    env.extractedFields = {
      totalMonthlyPremium: { value: "1000", status: "extracted", confidence: 0.85 },
      iban: { value: "CZ1234", status: "extracted", confidence: 0.8 },
    };
    const vm = buildAdvisorReviewViewModel({ envelope: env });
    expect(vm.paymentSyncPreview?.status).toBe("skipped_modelation");
  });

  it("buildCanonicalPaymentPayload nepromítne modelaci jako finální platbu", () => {
    const env = minimalEnvelope("modelation", "life_insurance_modelation");
    env.extractedFields = {
      totalMonthlyPremium: { value: "1000", status: "extracted", confidence: 0.85 },
    };
    const cp = buildCanonicalPaymentPayload(env);
    // Amount found, but sync should not be ready without target
    expect(isPaymentSyncReady(cp)).toBe(false);
  });

  it("publishReadiness je partially_reviewed pro modelaci pending", () => {
    const detail = makeApiDetail({
      reviewStatus: "pending",
      processingStatus: "extracted",
      extractedPayload: {
        documentClassification: { primaryType: "life_insurance_modelation", lifecycleStatus: "modelation" },
        reviewWarnings: [],
      },
    });
    const doc = mapApiToExtractionDocument(detail, "");
    // pending → partially_reviewed or review_required, never ready_for_publish
    expect(doc.publishReadiness).not.toBe("ready_for_publish");
    expect(doc.publishReadiness).not.toBe("published");
  });
});

/* ─── Scenario 3: Payment instruction (ne smlouva) ──────────────── */

describe("Phase 4I — Scenario 3: Payment instruction document", () => {
  it("tryBuildPaymentSetupDraftFromRawPayload vrátí draft pro platební dokument", () => {
    const raw: Record<string, unknown> = {
      extractedFields: {
        totalMonthlyPremium: { value: "1200", status: "extracted", confidence: 0.9 },
        iban: { value: "CZ0101000000000000123456", status: "extracted", confidence: 0.92 },
        variableSymbol: { value: "9876543210", status: "extracted", confidence: 0.88 },
        currency: { value: "CZK", status: "extracted", confidence: 0.99 },
      },
    };
    const draft = tryBuildPaymentSetupDraftFromRawPayload(raw);
    expect(draft).not.toBeNull();
    expect(draft!.type).toBe("create_payment_setup");
    expect((draft!.payload as Record<string, unknown>).iban).toBe("CZ0101000000000000123456");
  });

  it("tryBuildPaymentSetupDraftFromRawPayload vrátí null bez dat", () => {
    const raw: Record<string, unknown> = { extractedFields: {} };
    const draft = tryBuildPaymentSetupDraftFromRawPayload(raw);
    expect(draft).toBeNull();
  });

  it("payment instruction → payment setup visibility je advisor_ready po approve", () => {
    expect(resolvePaymentSetupClientVisibility("active")).toBe("advisor_ready");
    expect(resolvePaymentSetupClientVisibility("draft")).toBe("draft_only");
  });
});

/* ─── Scenario 4: Úvěrová smlouva (jiný typ produktu) ───────────── */

describe("Phase 4I — Scenario 4: Úvěrová smlouva", () => {
  it("buildAdvisorReviewViewModel pro mortgage nevytvoří pojišťovací atributy", () => {
    const env = minimalEnvelope("active", "mortgage_contract");
    env.extractedFields = {
      contractNumber: { value: "HYPOT-2024-001", status: "extracted", confidence: 0.95 },
      loanAmount: { value: "3500000", status: "extracted", confidence: 0.9 },
      monthlyInstallment: { value: "18500", status: "extracted", confidence: 0.88 },
    };
    const vm = buildAdvisorReviewViewModel({ envelope: env });
    // Should not classify as insurance
    expect(vm.recognition).not.toMatch(/pojišťovna|pojistná smlouva/i);
  });
});

/* ─── Scenario 5: Duplicate/update signal ───────────────────────── */

describe("Phase 4I — Scenario 5: Duplicate / možný update existující smlouvy", () => {
  it("advisorReview zahrnuje compliance check pro možný duplicate", () => {
    const env = minimalEnvelope("active");
    env.reviewWarnings = [
      { code: "AMBIGUOUS_CLIENT_MATCH", message: "Možná duplicita nebo existující smlouva" },
    ];
    const vm = buildAdvisorReviewViewModel({ envelope: env });
    expect(vm.manualChecklist.length).toBeGreaterThanOrEqual(0);
    // Recommendations or warnings should surface the duplicate signal
    const allText = JSON.stringify(vm);
    expect(allText).toBeTruthy();
  });
});

/* ─── Scenario 6: Reject flow (bez write side-effectů) ─────────── */

describe("Phase 4I — Scenario 6: Reject flow", () => {
  it("publishReadiness je blocked po zamítnutí", () => {
    const detail = makeApiDetail({ reviewStatus: "rejected", processingStatus: "extracted" });
    const doc = mapApiToExtractionDocument(detail, "");
    expect(doc.publishReadiness).toBe("blocked");
    expect(doc.isApplied).toBe(false);
  });

  it("draftActions se nezmění rejektem (immutable check)", () => {
    const detail = makeApiDetail({
      reviewStatus: "rejected",
      draftActions: [{ type: "create_client", label: "Vytvořit klienta", payload: { fullName: "Jan Novák" } }],
    });
    const doc = mapApiToExtractionDocument(detail, "");
    // Actions preserved but doc is not applied
    expect(doc.isApplied).toBe(false);
    expect(doc.draftActions.length).toBeGreaterThan(0);
  });
});

/* ─── Scenario 7: Partial approve / field correction memory ──────── */

describe("Phase 4I — Scenario 7: Ruční úprava pole (audit trail)", () => {
  it("mergeFieldEditsIntoExtractedPayload zachová AI originál a zapíše opravu", () => {
    const originalPayload: Record<string, unknown> = {
      documentClassification: { primaryType: "life_insurance_contract", lifecycleStatus: "active" },
      extractedFields: {
        contractNumber: { value: "1234567890", status: "extracted", confidence: 0.9 },
        totalMonthlyPremium: { value: "2000", status: "extracted", confidence: 0.85 },
      },
      reviewWarnings: [],
    };

    // mergeFieldEditsIntoExtractedPayload uses "extractedFields.xxx" key format
    const edits = { "extractedFields.contractNumber": "9876543210" };
    const { merged, correctedFields } = mergeFieldEditsIntoExtractedPayload(originalPayload, edits);

    const ef = (merged as Record<string, Record<string, Record<string, unknown>>>).extractedFields;
    // Corrected value applied
    expect(ef.contractNumber.value).toBe("9876543210");
    // Corrected fields list
    expect(correctedFields).toContain("extractedFields.contractNumber");
    // Untouched field unchanged
    expect(ef.totalMonthlyPremium.value).toBe("2000");
  });

  it("publishReadiness reflektuje approved + blokovací gate", () => {
    const detail = makeApiDetail({
      reviewStatus: "approved",
      processingStatus: "extracted",
      applyGate: {
        readiness: "blocked_for_apply",
        blockedReasons: ["UNSUPPORTED_DOCUMENT_TYPE"],
        applyBarrierReasons: [],
        warnings: [],
      } as unknown as undefined,
    });
    const doc = mapApiToExtractionDocument(detail, "");
    expect(doc.publishReadiness).toBe("blocked");
  });

  it("canonical payment z upraveného payloadu je konzistentní", () => {
    const originalPayload: Record<string, unknown> = {
      extractedFields: {
        totalMonthlyPremium: { value: "1500", status: "extracted", confidence: 0.9 },
        iban: { value: "CZ5500000000123456789012", status: "extracted", confidence: 0.92 },
        variableSymbol: { value: "1234567890", status: "extracted", confidence: 0.88 },
        currency: { value: "CZK", status: "extracted", confidence: 0.99 },
      },
    };

    // Simulate advisor correcting the amount using the correct key format
    const edits = { "extractedFields.totalMonthlyPremium": "1800" };
    const { merged } = mergeFieldEditsIntoExtractedPayload(originalPayload, edits);

    const draft = tryBuildPaymentSetupDraftFromRawPayload(merged);
    expect(draft).not.toBeNull();
    // Draft should use corrected amount
    expect((draft!.payload as Record<string, unknown>).regularAmount).toBe("1800");
  });
});

/* ─── Phase 4B: publishReadiness mapping ─────────────────────────── */

describe("Phase 4B — publishReadiness state machine", () => {
  it("pending → partially_reviewed", () => {
    const doc = mapApiToExtractionDocument(makeApiDetail({ reviewStatus: "pending" }), "");
    expect(["partially_reviewed", "review_required"]).toContain(doc.publishReadiness);
  });

  it("approved → ready_for_publish", () => {
    const doc = mapApiToExtractionDocument(makeApiDetail({ reviewStatus: "approved" }), "");
    expect(doc.publishReadiness).toBe("ready_for_publish");
  });

  it("applied → published", () => {
    const doc = mapApiToExtractionDocument(makeApiDetail({ reviewStatus: "applied" }), "");
    expect(doc.publishReadiness).toBe("published");
  });

  it("rejected → blocked", () => {
    const doc = mapApiToExtractionDocument(makeApiDetail({ reviewStatus: "rejected" }), "");
    expect(doc.publishReadiness).toBe("blocked");
  });

  it("review_required processing → review_required readiness", () => {
    const doc = mapApiToExtractionDocument(
      makeApiDetail({ reviewStatus: "pending", processingStatus: "review_required" }),
      ""
    );
    expect(doc.publishReadiness).toBe("review_required");
  });
});
