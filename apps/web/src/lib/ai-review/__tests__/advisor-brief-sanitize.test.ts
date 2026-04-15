import { describe, it, expect } from "vitest";
import { sanitizeAdvisorBrief } from "../advisor-review-view-model";
import { sanitizeAdvisorVisibleText } from "../czech-labels";
import type { DocumentReviewEnvelope } from "../../ai/document-review-types";

const emptyEnv = {} as DocumentReviewEnvelope;

describe("sanitizeAdvisorBrief", () => {
  it("strips combined_dip_dps_type_override:dps_keywords style fragments", () => {
    const raw =
      "Rozpoznala jsem smlouvu k DPS. Klient: Jan Novák. combined_dip_dps_type_override:dps_keywords";
    const out = sanitizeAdvisorBrief(raw, emptyEnv);
    expect(out).toBeDefined();
    expect(out).not.toMatch(/combined_dip_dps/);
    expect(out).not.toMatch(/dps_keywords/);
    expect(out).toMatch(/Jan Novák/);
  });

  it("strips bare dps_keywords token", () => {
    const out = sanitizeAdvisorBrief("Text. dps_keywords", emptyEnv);
    expect(out).toBeDefined();
    expect(out!.toLowerCase()).not.toContain("dps_keywords");
  });
});

describe("sanitizeAdvisorVisibleText", () => {
  it("removes forbidden pipeline tokens from advisor-facing strings", () => {
    const raw =
      "Kontrola: insurance_contract, investment_contract, extractedFields.contractNumber, text_pdf, policyholder";
    const out = sanitizeAdvisorVisibleText(raw);
    expect(out.toLowerCase()).not.toContain("insurance_contract");
    expect(out.toLowerCase()).not.toContain("investment_contract");
    expect(out.toLowerCase()).not.toContain("extractedfields");
    expect(out.toLowerCase()).not.toContain("text_pdf");
    expect(out.toLowerCase()).not.toContain("policyholder");
    expect(out).toMatch(/číslo smlouvy|údaj v dokumentu/i);
    expect(out).toMatch(/pojistník/i);
  });

  it("humanizes page_images pipeline token", () => {
    const out = sanitizeAdvisorVisibleText("page_images:not_implemented");
    expect(out.toLowerCase()).not.toContain("page_images");
    expect(out.length).toBeGreaterThan(10);
  });
});
