/**
 * AI Review — Prompt Builder rollout mapping (section-aware phase).
 *
 * Links:
 * - Local template bodies: `ai-review-prompt-templates-content.ts`
 * - Env IDs: `prompt-model-registry.ts` → `AI_REVIEW_REGISTRY[*].envKey`
 * - Required API variables: `ai-review-prompt-variables.ts` → `AI_REVIEW_PROMPT_REQUIRED_VARS`
 *
 * OpenAI Prompt Builder IDs are `pmpt_*` strings; never log full IDs in user-facing UI.
 */

import type { AiReviewPromptKey } from "./prompt-model-registry";
import { AI_REVIEW_REGISTRY } from "./prompt-model-registry";
import {
  getRequiredVarsForAiReviewPrompt,
  AI_REVIEW_EXTRACTION_OPTIONAL_SECTION_VARS,
} from "./ai-review-prompt-variables";

export { AI_REVIEW_EXTRACTION_OPTIONAL_SECTION_VARS };

export type PromptRolloutEntry = {
  promptKey: AiReviewPromptKey;
  /** Named export in `ai-review-prompt-templates-content.ts` */
  templateExport: string;
  envVar: string;
  versionEnvVar: string | null;
  requiredVariables: readonly string[];
  optionalSectionVariables: typeof AI_REVIEW_EXTRACTION_OPTIONAL_SECTION_VARS;
  fallbackBehavior: string;
  rolloutRisk: string;
};

const SECTION_OPTIONAL = AI_REVIEW_EXTRACTION_OPTIONAL_SECTION_VARS;

/**
 * Keys covered by reference templates in `ai-review-prompt-templates-content.ts`.
 * Other extraction keys still use Prompt Builder when env is set; copy pattern from those templates.
 */
export const AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS = [
  "insuranceContractExtraction",
  "investmentContractExtraction",
  "dipExtraction",
  "retirementProductExtraction",
  "insuranceProposalModelation",
  "healthSectionExtraction",
  "investmentSectionExtraction",
] as const satisfies readonly AiReviewPromptKey[];

export type SectionAwareTemplateKey = (typeof AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS)[number];

const TEMPLATE_EXPORT_BY_KEY: Record<SectionAwareTemplateKey, string> = {
  insuranceContractExtraction: "INSURANCE_CONTRACT_EXTRACTION_TEMPLATE",
  investmentContractExtraction: "INVESTMENT_CONTRACT_EXTRACTION_TEMPLATE",
  dipExtraction: "DIP_EXTRACTION_TEMPLATE",
  retirementProductExtraction: "RETIREMENT_PRODUCT_EXTRACTION_TEMPLATE",
  insuranceProposalModelation: "INSURANCE_PROPOSAL_MODELATION_TEMPLATE",
  healthSectionExtraction: "HEALTH_SECTION_EXTRACTION_TEMPLATE",
  investmentSectionExtraction: "INVESTMENT_SECTION_EXTRACTION_TEMPLATE",
};

const ROLLOUT_RISK_BY_KEY: Record<SectionAwareTemplateKey, string> = {
  insuranceContractExtraction:
    "Střední: špatně nastavené sekční proměnné mohou změnit váhu smluvní vs. zdravotní části; vždy nechte fallback {{extracted_text}}.",
  investmentContractExtraction:
    "Střední: DIP/DPS záměna pokud šablona nepoužívá investiční sekci; ověřit G05.",
  dipExtraction:
    "Střední: šablona musí držet productType DIP; jinak drift do life.",
  retirementProductExtraction:
    "Střední: terminologie DPS vs PP; ověřit penzijní scénáře.",
  insuranceProposalModelation:
    "Vysoké: nesprávný lifecycle → falešný „active“ contract; striktní pravidla v šabloně.",
  healthSectionExtraction:
    "Nízké: vstup je už zúžený orchestrátorem; Prompt Builder jen mění wording JSON.",
  investmentSectionExtraction:
    "Nízké: vstup zúžený; fallback structured output je stabilní.",
};

const FALLBACK_BY_KEY: Record<SectionAwareTemplateKey, string> = {
  insuranceContractExtraction:
    "Bez env ID + dost textu: `wrapExtractionPromptWithDocumentText` + schema prompt (včetně bundle section bloků). Bez textu: PDF + `buildFileBasedExtractionPrompt`.",
  investmentContractExtraction:
    "Stejně jako insuranceContractExtraction podle routeru a délky textu.",
  dipExtraction: "Stejně jako ostatní extract prompty — závisí na routeru a délce textu (Prompt Builder vs schema_text_wrap vs PDF).",
  retirementProductExtraction:
    "Stejně jako ostatní extract prompty — závisí na routeru a délce textu (Prompt Builder vs schema_text_wrap vs PDF).",
  insuranceProposalModelation:
    "Stejně jako ostatní extract prompty — závisí na routeru a délce textu (Prompt Builder vs schema_text_wrap vs PDF).",
  healthSectionExtraction:
    "Bez env ID: `buildHealthSectionExtractionPrompt` + `createResponseStructured` (hardcoded).",
  investmentSectionExtraction:
    "Bez env ID: `buildInvestmentSectionExtractionPrompt` + `createResponseStructured` (hardcoded).",
};

function requiredVarsForKey(key: SectionAwareTemplateKey): readonly string[] {
  return getRequiredVarsForAiReviewPrompt(key) ?? [];
}

/** Machine-readable rollout table for docs, CI, and tooling. */
export function getSectionAwareRolloutEntries(): PromptRolloutEntry[] {
  return AI_REVIEW_SECTION_AWARE_TEMPLATE_KEYS.map((promptKey) => {
    const reg = AI_REVIEW_REGISTRY[promptKey];
    return {
      promptKey,
      templateExport: TEMPLATE_EXPORT_BY_KEY[promptKey],
      envVar: reg.envKey,
      versionEnvVar: reg.versionEnvKey ?? null,
      requiredVariables: requiredVarsForKey(promptKey),
      optionalSectionVariables: SECTION_OPTIONAL,
      fallbackBehavior: FALLBACK_BY_KEY[promptKey],
      rolloutRisk: ROLLOUT_RISK_BY_KEY[promptKey],
    };
  });
}

/** Short fingerprint for logs / extractionTrace (not secret, not full ID). */
export function fingerprintOpenAiPromptId(promptId: string): string {
  const t = promptId.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 10)}…`;
}
