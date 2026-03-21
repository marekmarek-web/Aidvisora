import { describe, it, expect } from "vitest";
import {
  getSchemaForDocumentType,
  validateExtractionByType,
  buildExtractionPrompt,
  SECTION_CONFIDENCE_KEYS,
} from "../extraction-schemas-by-type";
import type { ContractDocumentType } from "../document-classification";

const DOC_TYPES: ContractDocumentType[] = [
  "insurance_contract",
  "investment_contract",
  "loan_or_mortgage_contract",
  "amendment",
  "application_or_proposal",
  "payment_document",
  "terms_and_conditions",
  "unknown",
];

describe("extraction-schemas-by-type", () => {
  describe("getSchemaForDocumentType", () => {
    it("returns schema and prompt fragment for each document type", () => {
      for (const docType of DOC_TYPES) {
        const info = getSchemaForDocumentType(docType);
        expect(info.schema).toBeDefined();
        expect(typeof info.promptFragment).toBe("string");
        expect(info.promptFragment.length).toBeGreaterThan(0);
      }
    });

    it("insurance_contract fragment mentions policyType or pojištění", () => {
      const info = getSchemaForDocumentType("insurance_contract");
      expect(info.promptFragment.toLowerCase()).toMatch(/policytype|pojistná|premium|beneficiary/);
    });

    it("loan_or_mortgage_contract fragment mentions loan or úvěr", () => {
      const info = getSchemaForDocumentType("loan_or_mortgage_contract");
      expect(info.promptFragment.toLowerCase()).toMatch(/loan|úvěr|interest|collateral/);
    });
  });

  describe("validateExtractionByType", () => {
    it("accepts valid minimal payload", () => {
      const raw = JSON.stringify({
        documentType: "insurance_contract",
        contractNumber: "123",
        institutionName: "Pojistovna",
        confidence: 0.8,
        needsHumanReview: false,
        missingFields: [],
      });
      const result = validateExtractionByType(raw, "insurance_contract");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.contractNumber).toBe("123");
        expect(result.data.confidence).toBe(0.8);
      }
    });

    it("accepts payload with fieldConfidenceMap", () => {
      const raw = JSON.stringify({
        contractNumber: "456",
        confidence: 0.9,
        fieldConfidenceMap: { contract: 0.9, client: 0.85, paymentDetails: 0.7 },
      });
      const result = validateExtractionByType(raw, "unknown");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.fieldConfidenceMap?.contract).toBe(0.9);
      }
    });

    it("accepts paymentDetails with null strings (model JSON)", () => {
      const raw = JSON.stringify({
        documentType: "loan_or_mortgage_contract",
        contractNumber: "CSOB-1",
        institutionName: "ČSOB",
        productName: "Spotřebitelský úvěr",
        paymentDetails: {
          iban: null,
          accountNumber: null,
          currency: "CZK",
          amount: 500000,
        },
        confidence: 0.85,
      });
      const result = validateExtractionByType(raw, "loan_or_mortgage_contract");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.paymentDetails?.iban).toBeUndefined();
        expect(result.data.paymentDetails?.currency).toBe("CZK");
      }
    });

    it("rejects invalid JSON", () => {
      const result = validateExtractionByType("not json at all", "unknown");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe("buildExtractionPrompt", () => {
    it("includes base and type-specific fragment", () => {
      const prompt = buildExtractionPrompt("insurance_contract", false);
      expect(prompt).toContain("JSON");
      expect(prompt).toContain("fieldConfidenceMap");
      expect(prompt).toMatch(/pojistná|insurance|policyType/i);
    });

    it("includes scan hint when isScanFallback is true", () => {
      const promptScan = buildExtractionPrompt("unknown", true);
      const promptText = buildExtractionPrompt("unknown", false);
      expect(promptScan).toMatch(/naskenovaný|scan/i);
      expect(promptScan.length).toBeGreaterThan(promptText.length);
    });
  });

  describe("SECTION_CONFIDENCE_KEYS", () => {
    it("includes expected sections", () => {
      expect(SECTION_CONFIDENCE_KEYS).toContain("contract");
      expect(SECTION_CONFIDENCE_KEYS).toContain("client");
      expect(SECTION_CONFIDENCE_KEYS).toContain("paymentDetails");
      expect(SECTION_CONFIDENCE_KEYS).toContain("dates");
    });
  });
});
