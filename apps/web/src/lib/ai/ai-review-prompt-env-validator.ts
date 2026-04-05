/**
 * Validates presence of OpenAI Prompt Builder env IDs for AI Review.
 * Used by tests and optional strict CI (`AI_REVIEW_ENV_VALIDATE_STRICT=1`).
 */

import type { AiReviewPromptKey } from "./prompt-model-registry";
import { AI_REVIEW_REGISTRY } from "./prompt-model-registry";
import {
  AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS,
  type SectionAwareTemplateKey,
} from "./ai-review-prompt-rollout";

export type AiReviewPromptEnvValidationResult = {
  /** Keys checked (section-aware rollout set unless overridden). */
  keysChecked: readonly AiReviewPromptKey[];
  configured: AiReviewPromptKey[];
  missing: AiReviewPromptKey[];
  /** Human-readable lines for logging. */
  lines: string[];
};

function promptIdPresentInEnv(env: NodeJS.ProcessEnv, key: AiReviewPromptKey): boolean {
  const envKey = AI_REVIEW_REGISTRY[key].envKey;
  return Boolean(env[envKey]?.trim());
}

export function validateAiReviewPromptEnv(
  env: NodeJS.ProcessEnv,
  keys: readonly AiReviewPromptKey[] = AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS,
): AiReviewPromptEnvValidationResult {
  const configured: AiReviewPromptKey[] = [];
  const missing: AiReviewPromptKey[] = [];
  for (const key of keys) {
    if (promptIdPresentInEnv(env, key)) configured.push(key);
    else missing.push(key);
  }
  const lines = keys.map((key) => {
    const reg = AI_REVIEW_REGISTRY[key];
    const ok = promptIdPresentInEnv(env, key);
    return `${ok ? "OK " : "MISS"} ${key} → ${reg.envKey}`;
  });
  return { keysChecked: keys, configured, missing, lines };
}

/** Validate only section-aware template keys (default rollout bundle). */
export function validateSectionAwareRolloutEnv(env: NodeJS.ProcessEnv): AiReviewPromptEnvValidationResult {
  return validateAiReviewPromptEnv(env, AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS);
}

export function formatAiReviewPromptEnvReport(result: AiReviewPromptEnvValidationResult): string {
  const head = `AI Review Prompt env (${result.keysChecked.length} keys checked)\n`;
  return head + result.lines.join("\n");
}

/** All AI Review keys from registry (large list). */
export function allAiReviewPromptKeys(): AiReviewPromptKey[] {
  return Object.keys(AI_REVIEW_REGISTRY) as AiReviewPromptKey[];
}

export function isSectionAwareTemplateKey(k: string): k is SectionAwareTemplateKey {
  return (AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS as readonly string[]).includes(k);
}
