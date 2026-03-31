import { describe, expect, it } from "vitest";
import type { ClassificationResult } from "../document-classification";
import {
  tryCoerceReviewEnvelopeAfterValidationFailure,
  mergePartialParsedIntoManualStub,
} from "../coerce-partial-review-envelope";
import { buildManualReviewStubEnvelope } from "../ai-review-manual-stub";

const classification: ClassificationResult = {
  primaryType: "life_insurance_investment_contract",
  subtype: "investment_life_insurance",
  lifecycleStatus: "final_contract",
  documentIntent: "creates_new_product",
  confidence: 0.85,
  reasons: ["test"],
};

const CLASSIFIER_GARBAGE_PAYLOAD = {
  documentType: "insurance_contract",
  documentTypeLabel: "neurčeno",
  normalizedDocumentType: "unknown",
  productFamily: "life_insurance",
  productFamilyLabel: "životní pojištění",
  productSubtype: "investment_life_insurance",
  productSubtypeLabel: "investiční životní pojištění",
  businessIntent: "contract_intake",
  businessIntentLabel: "příjem smlouvy",
  recommendedRoute: "manual_review",
  supportedForDirectExtraction: false,
  documentTypeUncertain: true,
  rawClassification:
    "Chybí čitelný text dokumentu; z názvu souboru lze pouze odvodit pojistnou smlouvu.",
  warnings: ["K dispozici není čitelný text.", "Klasifikace založena jen na názvu."],
  reasons: ["Název souboru obsahuje pojistnou smlouvu."],
  confidence: 0.4,
};

describe("collectTopLevelFieldCandidates — classifier field filtering", () => {
  it("does NOT leak classifier output keys into extractedFields during coercion", () => {
    const parsed = {
      ...CLASSIFIER_GARBAGE_PAYLOAD,
      documentClassification: {
        primaryType: "life_insurance_investment_contract",
        lifecycleStatus: "final_contract",
        documentIntent: "creates_new_product",
        confidence: 0.8,
        reasons: [],
      },
      documentMeta: { scannedVsDigital: "digital" },
      extractedFields: {},
      parties: {},
      reviewWarnings: [],
      suggestedActions: [],
    };

    const coerced = tryCoerceReviewEnvelopeAfterValidationFailure(
      parsed,
      "life_insurance_investment_contract",
      classification
    );

    expect(coerced).not.toBeNull();
    const fieldKeys = Object.keys(coerced!.extractedFields);

    expect(fieldKeys).not.toContain("documentType");
    expect(fieldKeys).not.toContain("documentTypeLabel");
    expect(fieldKeys).not.toContain("normalizedDocumentType");
    expect(fieldKeys).not.toContain("rawClassification");
    expect(fieldKeys).not.toContain("recommendedRoute");
    expect(fieldKeys).not.toContain("supportedForDirectExtraction");
    expect(fieldKeys).not.toContain("warnings");
    expect(fieldKeys).not.toContain("reasons");
    expect(fieldKeys).not.toContain("productFamily");
    expect(fieldKeys).not.toContain("productSubtype");
    expect(fieldKeys).not.toContain("businessIntent");
    expect(fieldKeys).not.toContain("documentTypeUncertain");
  });

  it("does NOT leak classifier fields via mergePartialParsedIntoManualStub", () => {
    const stub = buildManualReviewStubEnvelope({
      classification,
      inputMode: "text_pdf",
      extractionMode: "direct",
      pageCount: 1,
      norm: "life_insurance_investment",
      route: "contract_intake",
    });

    mergePartialParsedIntoManualStub(stub, CLASSIFIER_GARBAGE_PAYLOAD as Record<string, unknown>, 2000);

    const fieldKeys = Object.keys(stub.extractedFields);
    expect(fieldKeys).not.toContain("documentType");
    expect(fieldKeys).not.toContain("rawClassification");
    expect(fieldKeys).not.toContain("recommendedRoute");
    expect(fieldKeys).not.toContain("supportedForDirectExtraction");
    expect(fieldKeys).not.toContain("warnings");
    expect(fieldKeys).not.toContain("reasons");
  });

  it("DOES collect valid extraction fields with {value, status} shape", () => {
    const parsed = {
      documentClassification: {
        primaryType: "life_insurance_investment_contract",
        lifecycleStatus: "final_contract",
        documentIntent: "creates_new_product",
        confidence: 0.9,
        reasons: [],
      },
      documentMeta: { scannedVsDigital: "digital" },
      extractedFields: {},
      parties: {},
      reviewWarnings: [],
      suggestedActions: [],
      insurer: { value: "Generali", status: "extracted", confidence: 0.95 },
      productName: { value: "Bel Mondo 20", status: "extracted", confidence: 0.9 },
      contractNumber: "3282880076",
    };

    const coerced = tryCoerceReviewEnvelopeAfterValidationFailure(
      parsed,
      "life_insurance_investment_contract",
      classification
    );

    expect(coerced).not.toBeNull();
    expect(coerced!.extractedFields.insurer?.value).toBe("Generali");
    expect(coerced!.extractedFields.productName?.value).toBe("Bel Mondo 20");
    expect(coerced!.extractedFields.contractNumber?.value).toBe("3282880076");
  });

  it("rejects boolean and array values at top level", () => {
    const parsed = {
      documentClassification: {
        primaryType: "life_insurance_investment_contract",
        lifecycleStatus: "final_contract",
        documentIntent: "creates_new_product",
        confidence: 0.9,
        reasons: [],
      },
      documentMeta: { scannedVsDigital: "digital" },
      extractedFields: {},
      parties: {},
      reviewWarnings: [],
      suggestedActions: [],
      someBool: true,
      someArray: ["a", "b"],
    };

    const coerced = tryCoerceReviewEnvelopeAfterValidationFailure(
      parsed,
      "life_insurance_investment_contract",
      classification
    );

    expect(coerced).not.toBeNull();
    expect(Object.keys(coerced!.extractedFields)).not.toContain("someBool");
    expect(Object.keys(coerced!.extractedFields)).not.toContain("someArray");
  });
});
