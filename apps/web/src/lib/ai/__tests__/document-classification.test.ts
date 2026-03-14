import { describe, it, expect, vi } from "vitest";
import { classifyContractDocument, parseClassificationResponse, CONTRACT_DOCUMENT_TYPES } from "../document-classification";

vi.mock("@/lib/openai", () => ({
  createResponseWithFile: vi.fn(),
}));

describe("document-classification", () => {
  describe("parseClassificationResponse", () => {
    it("parses valid JSON with known document type", () => {
      const raw = JSON.stringify({
        documentType: "insurance_contract",
        confidence: 0.9,
        reasons: ["Pojistná smlouva", "Premium field"],
      });
      const result = parseClassificationResponse(raw);
      expect(result.documentType).toBe("insurance_contract");
      expect(result.confidence).toBe(0.9);
      expect(result.reasons).toHaveLength(2);
    });

    it("returns unknown when documentType is invalid", () => {
      const raw = JSON.stringify({
        documentType: "invalid_type",
        confidence: 0.5,
        reasons: [],
      });
      const result = parseClassificationResponse(raw);
      expect(result.documentType).toBe("unknown");
      expect(result.confidence).toBe(0);
      expect(result.reasons[0]).toContain("Parse error");
    });

    it("extracts JSON from markdown-wrapped response", () => {
      const raw = `Here is the result:\n\`\`\`json\n${JSON.stringify({
        documentType: "loan_or_mortgage_contract",
        confidence: 0.85,
        reasons: ["Úvěr"],
      })}\n\`\`\``;
      const result = parseClassificationResponse(raw);
      expect(result.documentType).toBe("loan_or_mortgage_contract");
      expect(result.confidence).toBe(0.85);
    });

    it("accepts all CONTRACT_DOCUMENT_TYPES", () => {
      for (const docType of CONTRACT_DOCUMENT_TYPES) {
        const raw = JSON.stringify({ documentType: docType, confidence: 0.8, reasons: [] });
        const result = parseClassificationResponse(raw);
        expect(result.documentType).toBe(docType);
      }
    });
  });

  describe("classifyContractDocument", () => {
    it("returns parsed result when createResponseWithFile returns valid JSON", async () => {
      const openai = await import("@/lib/openai");
      vi.mocked(openai.createResponseWithFile).mockResolvedValueOnce(
        JSON.stringify({
          documentType: "payment_document",
          confidence: 0.75,
          reasons: ["Platební doklad"],
        })
      );
      const result = await classifyContractDocument("https://example.com/file.pdf");
      expect(result.documentType).toBe("payment_document");
      expect(result.confidence).toBe(0.75);
      expect(openai.createResponseWithFile).toHaveBeenCalledWith(
        "https://example.com/file.pdf",
        expect.any(String)
      );
    });
  });
});
