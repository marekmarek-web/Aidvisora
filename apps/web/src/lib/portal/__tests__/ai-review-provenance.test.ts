import { describe, it, expect } from "vitest";
import {
  contractSourceKindLabel,
  resolveAiProvenanceKind,
} from "../ai-review-provenance";

describe("ai-review-provenance", () => {
  describe("resolveAiProvenanceKind", () => {
    it("returns null for non-ai_review sourceKind", () => {
      expect(resolveAiProvenanceKind("manual", new Date())).toBeNull();
      expect(resolveAiProvenanceKind("document", null)).toBeNull();
      expect(resolveAiProvenanceKind(undefined, null)).toBeNull();
    });

    it("returns confirmed when advisorConfirmedAt is set", () => {
      expect(resolveAiProvenanceKind("ai_review", new Date("2025-01-15"))).toBe("confirmed");
      expect(resolveAiProvenanceKind("ai_review", "2025-01-15")).toBe("confirmed");
    });

    it("returns auto_applied for ai_review without confirmation timestamp", () => {
      expect(resolveAiProvenanceKind("ai_review", null)).toBe("auto_applied");
      expect(resolveAiProvenanceKind("ai_review", undefined)).toBe("auto_applied");
    });
  });

  describe("contractSourceKindLabel", () => {
    it("maps known source kinds", () => {
      expect(contractSourceKindLabel("document")).toBe("Dokument");
      expect(contractSourceKindLabel("ai_review")).toBe("AI kontrola");
      expect(contractSourceKindLabel("import")).toBe("Import");
    });

    it("defaults to manual label", () => {
      expect(contractSourceKindLabel("manual")).toBe("Ručně");
      expect(contractSourceKindLabel("anything")).toBe("Ručně");
    });
  });
});
