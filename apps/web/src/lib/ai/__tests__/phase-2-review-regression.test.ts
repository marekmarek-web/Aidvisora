/**
 * Phase 2F regression: identifiers, dates, payment mapping, advisor UI, confidence keys.
 * Run: pnpm test:ai-review-phase2-regression
 */

import { describe, expect, it } from "vitest";
import type { DocumentReviewEnvelope } from "../document-review-types";
import { applyExtractedFieldAliasNormalizations } from "../extraction-field-alias-normalize";
import {
  normalizeDateForAdvisorDisplay,
  normalizeDateToISO,
  normalizeExtractedFieldDates,
} from "../canonical-date-normalize";
import { mapPaymentExtractionToPortalDraftPayload } from "../payment-instruction-extraction";
import { mapApiToExtractionDocument } from "../../ai-review/mappers";
import { buildAdvisorReviewViewModel } from "../../ai-review/advisor-review-view-model";

function phase2BaseEnvelope(
  primaryType: DocumentReviewEnvelope["documentClassification"]["primaryType"]
): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType,
      subtype: "fixture",
      lifecycleStatus: "final_contract",
      documentIntent: "reference_only",
      confidence: 0.86,
      reasons: ["phase2_fixture"],
    },
    documentMeta: {
      scannedVsDigital: "digital",
      overallConfidence: 0.86,
    },
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
    sensitivityProfile: "standard_personal_data",
    contentFlags: {
      isFinalContract: true,
      isProposalOnly: false,
      containsPaymentInstructions: false,
      containsClientData: false,
      containsAdvisorData: false,
      containsMultipleDocumentSections: false,
    },
  };
}

describe("Phase 2F — canonical dates", () => {
  it("normalizes Czech dotted dates to ISO", () => {
    expect(normalizeDateToISO("15. 3. 2024")).toBe("2024-03-15");
    expect(normalizeDateToISO("1.1.1980")).toBe("1980-01-01");
    expect(normalizeDateToISO("2024-03-15")).toBe("2024-03-15");
  });

  it("normalizes slash and compact DDMMYYYY", () => {
    expect(normalizeDateToISO("05/12/2023")).toBe("2023-12-05");
    expect(normalizeDateToISO("15032024")).toBe("2024-03-15");
  });

  it("formats advisor display with TIME DD.MM.YYYY when time present", () => {
    expect(normalizeDateForAdvisorDisplay("14:30 15. 3. 2024")).toBe("14:30 15.03.2024");
    expect(normalizeDateForAdvisorDisplay("2024-03-15T09:00:00")).toBe("09:00 15.03.2024");
  });

  it("normalizeExtractedFieldDates converts date cells to ISO in place", () => {
    const ef: Record<string, { value?: unknown }> = {
      birthDate: { value: "9.11.1983" },
      policyStartDate: { value: "2024-01-02" },
    };
    normalizeExtractedFieldDates(ef);
    expect(ef.birthDate.value).toBe("1983-11-09");
    expect(ef.policyStartDate.value).toBe("2024-01-02");
  });
});

describe("Phase 2F — alias normalization (final contract vs modelation)", () => {
  it("final contract keeps contractNumber as primary for composite refs", () => {
    const env = phase2BaseEnvelope("life_insurance_final_contract");
    env.extractedFields = {
      contractNumber: { value: "FINAL-999", status: "extracted", confidence: 0.92 },
      proposalNumber: { value: "PROP-1", status: "extracted", confidence: 0.8 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(String(env.extractedFields.proposalNumber_or_contractNumber?.value)).toBe("FINAL-999");
  });

  it("modelation does not fill contractNumber from policy-style aliases only", () => {
    const env = phase2BaseEnvelope("life_insurance_modelation");
    env.documentClassification.lifecycleStatus = "modelation";
    env.extractedFields = {
      modelationId: { value: "MOD-4242", status: "extracted", confidence: 0.9 },
      proposalNumber: { value: "PROP-7", status: "extracted", confidence: 0.85 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.contractNumber?.value).toBeUndefined();
    expect(String(env.extractedFields.proposalNumber_or_contractNumber?.value)).toMatch(/MOD-4242|PROP-7/);
  });
});

describe("Phase 2F — payment instruction mapping (comma decimals)", () => {
  it("preserves comma decimal string in portal draft payload", () => {
    const draft = mapPaymentExtractionToPortalDraftPayload({
      institutionName: "Test Bank",
      productName: "Pojištění X",
      amount: "1 234,56",
      currency: "CZK",
      paymentFrequency: "měsíčně",
      iban: "CZ6508000000192000145399",
      variableSymbol: "1234567890",
      confidence: 0.88,
    });
    expect(draft.regularAmount).toBe("1 234,56");
    expect(draft.currency).toBe("CZK");
    expect(draft.iban).toContain("CZ65");
  });
});

describe("Phase 2F — advisor UI (English keys → Czech labels + date display)", () => {
  it("mapApiToExtractionDocument shows ISO dates as DD.MM.YYYY and Czech labels", () => {
    const detail: Record<string, unknown> = {
      id: "rev-1",
      fileName: "smlouva.pdf",
      confidence: 0.9,
      processingStatus: "extracted",
      reviewStatus: "pending",
      detectedDocumentType: "life_insurance_contract",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fieldConfidenceMap: { contractNumber: 0.93, contract: 0.2 },
      extractedPayload: {
        documentClassification: {
          primaryType: "life_insurance_contract",
          lifecycleStatus: "final_contract",
          confidence: 0.9,
          reasons: [],
        },
        documentMeta: { scannedVsDigital: "digital" },
        parties: {},
        reviewWarnings: [],
        extractedFields: {
          documentIssueDate: { value: "2026-04-01", status: "extracted", confidence: 0.88 },
          contractNumber: { value: "ZP-100", status: "extracted", confidence: 0.9 },
        },
      },
    };
    const doc = mapApiToExtractionDocument(detail, "");
    const fields = doc.groups.flatMap((g) => g.fields);
    const issue = fields.find((f) => f.id === "extractedFields.documentIssueDate");
    const cn = fields.find((f) => f.id === "extractedFields.contractNumber");
    expect(issue?.label).toMatch(/datum|vystaven/i);
    expect(issue?.value).toBe("01.04.2026");
    expect(cn?.confidence).toBe(93);
  });
});

describe("Phase 2F — advisor brief guardrails", () => {
  it("buildAdvisorReviewViewModel prepends product and shortens pathological LLM output", () => {
    const envelope = phase2BaseEnvelope("life_insurance_contract");
    envelope.extractedFields = {
      productName: { value: "Bel Mondo 20", status: "extracted", confidence: 0.9 },
      contractNumber: { value: "CN-1", status: "extracted", confidence: 0.9 },
    };
    const longNoise = "foo_bar_baz_qux ".repeat(600);
    const vm = buildAdvisorReviewViewModel({
      envelope,
      detectedDocumentTypeLabel: "Životní pojištění",
      llmExecutiveBrief: `${longNoise} Krátký užitečný text na konci.`,
    });
    expect(vm.llmExecutiveBrief).toBeDefined();
    expect(vm.llmExecutiveBrief!.length).toBeLessThanOrEqual(2100);
    expect(vm.llmExecutiveBrief).toContain("Bel Mondo");
  });
});
