/**
 * Rollout mapping + fingerprint helpers for Prompt Builder phase.
 */

import { describe, it, expect } from "vitest";
import {
  getSectionAwareRolloutEntries,
  fingerprintOpenAiPromptId,
  AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS,
} from "@/lib/ai/ai-review-prompt-rollout";
import { AI_REVIEW_EXTRACTION_OPTIONAL_SECTION_VARS } from "@/lib/ai/ai-review-prompt-variables";

describe("AI Review prompt rollout mapping", () => {
  it("exports exactly 7 section-aware template keys", () => {
    expect(AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS).toHaveLength(7);
  });

  it("getSectionAwareRolloutEntries returns 7 rows with env + template export", () => {
    const rows = getSectionAwareRolloutEntries();
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(row.envVar).toMatch(/^OPENAI_PROMPT_AI_REVIEW_/);
      expect(row.templateExport.length).toBeGreaterThan(5);
      expect(row.requiredVariables).toContain("extracted_text");
      expect(row.requiredVariables).toContain("filename");
      expect(row.fallbackBehavior.length).toBeGreaterThan(10);
      expect(row.rolloutRisk.length).toBeGreaterThan(5);
    }
  });

  it("optional section vars list is non-empty and stable", () => {
    expect(AI_REVIEW_EXTRACTION_OPTIONAL_SECTION_VARS.length).toBeGreaterThanOrEqual(6);
    expect(AI_REVIEW_EXTRACTION_OPTIONAL_SECTION_VARS).toContain("contractual_section_text");
  });

  it("fingerprintOpenAiPromptId truncates long pmpt ids", () => {
    const id = "pmpt_abcdefghijklmnopqrstuvwxyz0123456789";
    const fp = fingerprintOpenAiPromptId(id);
    expect(fp.length).toBeLessThan(id.length);
    expect(fp.endsWith("…")).toBe(true);
  });
});
