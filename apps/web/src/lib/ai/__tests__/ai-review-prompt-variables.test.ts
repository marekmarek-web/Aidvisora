import { describe, it, expect } from "vitest";
import {
  buildAiReviewExtractionPromptVariables,
  capAiReviewPromptString,
  coerceNonEmptyAiReviewVariables,
  findMissingAiReviewPromptVariables,
} from "../ai-review-prompt-variables";

describe("findMissingAiReviewPromptVariables", () => {
  it("docClassifierV2 requires all six Prompt Builder keys", () => {
    expect(findMissingAiReviewPromptVariables("docClassifierV2", { filename: "x" }).length).toBeGreaterThan(0);
    expect(
      findMissingAiReviewPromptVariables("docClassifierV2", {
        filename: "a.pdf",
        page_count: "2",
        input_mode: "text_pdf",
        text_excerpt: "hello",
        adobe_signals: "none",
        source_channel: "ai_review",
      })
    ).toEqual([]);
  });

  it("returns empty when all extraction vars present", () => {
    const m = findMissingAiReviewPromptVariables("loanContractExtraction", {
      extracted_text: "x",
      classification_reasons: "[]",
      adobe_signals: "{}",
      filename: "a.pdf",
    });
    expect(m).toEqual([]);
  });

  it("flags empty or missing required keys for reviewDecision", () => {
    expect(findMissingAiReviewPromptVariables("reviewDecision", {})).toContain("normalized_document_type");
    expect(
      findMissingAiReviewPromptVariables("reviewDecision", {
        normalized_document_type: "t",
        extraction_payload: "{}",
        validation_warnings: "[]",
        section_confidence: "{}",
        input_mode: "text_pdf",
        preprocess_warnings: "   ",
      })
    ).toEqual(["preprocess_warnings"]);
  });
});

describe("buildAiReviewExtractionPromptVariables", () => {
  it("includes legacy document_text by default", () => {
    const v = buildAiReviewExtractionPromptVariables({
      documentText: "hello world",
      classificationReasons: ["a"],
      adobeSignals: "none",
      filename: "f.pdf",
    });
    expect(v.extracted_text).toContain("hello");
    expect(v.document_text).toBe(v.extracted_text);
    expect(v.classification_reasons).toBe(JSON.stringify(["a"]));
  });
});

describe("coerceNonEmptyAiReviewVariables", () => {
  it("fills missing extraction keys and camelCase mirrors", () => {
    const c = coerceNonEmptyAiReviewVariables("loanContractExtraction", {
      extracted_text: "  body  ",
    });
    expect(c.filename).toBe("unknown");
    expect(c.adobe_signals).toBe("none");
    expect(c.classification_reasons).toBe("[]");
    expect(c.extracted_text).toBe("  body  ");
    expect(c.extractedText).toBe("  body  ");
    expect(c.adobeSignals).toBe("none");
  });
});

describe("capAiReviewPromptString", () => {
  it("truncates beyond max", () => {
    const s = "x".repeat(100);
    const c = capAiReviewPromptString(s, 40);
    expect(c.length).toBeLessThan(s.length);
    expect(c).toContain("truncated");
  });
});

/**
 * REGRESSION: IŽP / life insurance pipeline — missing optional section vars crash (400)
 *
 * Previously, section vars (investment_section_text, payment_section_text, etc.) were only
 * populated when bundleSectionTexts was non-null. Stored OpenAI Prompt Builder templates
 * that reference these as template variables returned HTTP 400 "Missing prompt variables"
 * for non-bundle IŽP documents.
 *
 * Fix: always populate section vars with safe defaults.
 */
describe("REGRESSION: optional section vars always present — no 400 from stored prompts", () => {
  it("section vars present with safe defaults when bundleSectionTexts is null (non-bundle IŽP doc)", () => {
    const vars = buildAiReviewExtractionPromptVariables({
      documentText: "IŽP Generali smlouva č. 1234567890",
      classificationReasons: ["life_insurance_investment_contract"],
      adobeSignals: "none",
      filename: "IŽP - Generali.pdf",
    });
    // Must never be absent — absence causes OpenAI 400 "Missing prompt variables"
    expect(vars).toHaveProperty("investment_section_text");
    expect(vars).toHaveProperty("payment_section_text");
    expect(vars).toHaveProperty("contractual_section_text");
    expect(vars).toHaveProperty("health_section_text");
    expect(vars).toHaveProperty("attachment_section_text");
    expect(vars).toHaveProperty("bundle_section_context");
    // Safe defaults — not empty strings (empty strings fail Prompt Builder validation)
    expect(vars.investment_section_text).toBe("(not available)");
    expect(vars.payment_section_text).toBe("(not available)");
    expect(vars.contractual_section_text).toBe("(not available)");
    expect(vars.health_section_text).toBe("(not available)");
  });

  it("camelCase mirrors also always present", () => {
    const vars = buildAiReviewExtractionPromptVariables({
      documentText: "IŽP smlouva",
      classificationReasons: [],
      adobeSignals: "none",
      filename: "izp.pdf",
    });
    expect(vars.investmentSectionText).toBe("(not available)");
    expect(vars.paymentSectionText).toBe("(not available)");
    expect(vars.contractualSectionText).toBe("(not available)");
    expect(vars.healthSectionText).toBe("(not available)");
  });

  it("bundle docs with real section texts override the defaults", () => {
    const vars = buildAiReviewExtractionPromptVariables({
      documentText: "bundle full text",
      classificationReasons: [],
      adobeSignals: "none",
      filename: "bundle.pdf",
      bundleSectionTexts: {
        contractualText: "Smluvní část smlouvy",
        investmentText: "Investiční strategie: Vyvážená",
        paymentText: "IBAN: CZ1234567890",
      },
    });
    expect(vars.contractual_section_text).toContain("Smluvní část");
    expect(vars.investment_section_text).toContain("Vyvážená");
    expect(vars.payment_section_text).toContain("IBAN");
    // Sections not provided fall back to "(not available)"
    expect(vars.health_section_text).toBe("(not available)");
    expect(vars.attachment_section_text).toBe("(not available)");
  });

  it("empty string bundleSectionTexts fields fall back to (not available), not empty", () => {
    const vars = buildAiReviewExtractionPromptVariables({
      documentText: "doc",
      classificationReasons: [],
      adobeSignals: "none",
      filename: "doc.pdf",
      bundleSectionTexts: {
        contractualText: "",
        healthText: "   ",
        investmentText: null,
        paymentText: undefined,
      },
    });
    // All null/empty/whitespace → "(not available)"
    expect(vars.contractual_section_text).toBe("(not available)");
    expect(vars.health_section_text).toBe("(not available)");
    expect(vars.investment_section_text).toBe("(not available)");
    expect(vars.payment_section_text).toBe("(not available)");
  });
});
