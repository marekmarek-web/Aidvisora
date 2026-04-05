/**
 * Env validation for AI Review Prompt Builder IDs.
 * Set AI_REVIEW_ENV_VALIDATE_STRICT=1 in CI to require all 7 section-aware IDs.
 */

import { describe, it, expect } from "vitest";
import {
  validateSectionAwareRolloutEnv,
  validateAiReviewPromptEnv,
  formatAiReviewPromptEnvReport,
} from "@/lib/ai/ai-review-prompt-env-validator";
import { AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS } from "@/lib/ai/ai-review-prompt-rollout";

describe("validateSectionAwareRolloutEnv", () => {
  it("detects missing vs configured from a stub env object", () => {
    const env = {
      OPENAI_PROMPT_AI_REVIEW_INSURANCE_CONTRACT_EXTRACTION_ID: "pmpt_test123",
    } as NodeJS.ProcessEnv;
    const r = validateSectionAwareRolloutEnv(env);
    expect(r.configured).toContain("insuranceContractExtraction");
    expect(r.missing.length).toBe(6);
    expect(r.lines.some((l) => l.startsWith("OK ") && l.includes("insuranceContractExtraction"))).toBe(true);
    expect(r.lines.some((l) => l.startsWith("MISS ") && l.includes("dipExtraction"))).toBe(true);
  });

  it("formatAiReviewPromptEnvReport includes all keys", () => {
    const r = validateSectionAwareRolloutEnv({});
    const text = formatAiReviewPromptEnvReport(r);
    expect(text).toContain("dipExtraction");
    expect(text.split("\n").length).toBeGreaterThanOrEqual(AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS.length + 1);
  });

  it("validateAiReviewPromptEnv can check a single key", () => {
    const env = {} as NodeJS.ProcessEnv;
    const r = validateAiReviewPromptEnv(env, ["healthSectionExtraction"]);
    expect(r.missing).toEqual(["healthSectionExtraction"]);
    expect(r.keysChecked).toHaveLength(1);
  });
});

describe("strict CI: all section-aware prompt env IDs (opt-in)", () => {
  it.skipIf(!process.env.AI_REVIEW_ENV_VALIDATE_STRICT)(
    "every AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS id must be set in process.env",
    () => {
      const r = validateSectionAwareRolloutEnv(process.env);
      expect(r.missing, `Missing: ${r.missing.join(", ")}`).toEqual([]);
    },
  );
});
