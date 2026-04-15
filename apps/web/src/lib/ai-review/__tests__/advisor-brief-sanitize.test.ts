import { describe, it, expect } from "vitest";
import { sanitizeAdvisorBrief } from "../advisor-review-view-model";
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
