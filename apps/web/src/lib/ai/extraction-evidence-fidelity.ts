/**
 * Extraction Evidence Fidelity
 *
 * Provides utilities for tracking and comparing the evidence quality of extracted
 * field values across different extraction contexts (section-local vs full-document).
 *
 * Priority order (highest → lowest):
 *   explicit_section       – extracted from the dedicated, narrowed section window
 *   explicit_subdocument   – extracted from a recognized typed subdocument
 *   inferred_section       – inferred within the same logical section
 *   cross_section_inference– value inferred from a different section
 *   global_context_guess   – low-confidence guess from full document context
 *
 * Usage pattern in the orchestrator:
 *   1. Run section-local extraction on narrowed text → tag results as explicit_section
 *   2. Existing envelope fields come from full-doc extraction → tag as global_context_guess
 *      unless they already have high confidence or sourcePage
 *   3. Merge: prefer higher-fidelity; when tied, prefer existing (stability)
 */

import type { EvidenceFidelityLevel } from "./document-packet-types";
import { isHigherFidelity } from "./document-packet-types";
import type { SectionTextWindow } from "./section-text-slicer";

// ─── Evidence-tagged value ────────────────────────────────────────────────────

export interface EvidenceTaggedValue<T = unknown> {
  value: T | null;
  fidelity: EvidenceFidelityLevel;
  /** Short snippet from the source text that supports this value (for tracing). */
  sourceSnippet?: string | null;
  /** Character offset in the source window where evidence was found. */
  sourceOffset?: number | null;
}

// ─── Fidelity inference helpers ───────────────────────────────────────────────

/**
 * Infer the fidelity level for a field extracted from a section window.
 *
 * Rules:
 * - Extracted from a narrowed section window + LLM says "extracted" → explicit_section
 * - Extracted from a narrowed window + LLM says "inferred" → inferred_section
 * - Extracted from full text + high confidence (≥ 0.8) → explicit_subdocument
 * - Extracted from full text + medium confidence → cross_section_inference
 * - Anything else → global_context_guess
 */
export function inferFidelityFromContext(params: {
  extractionStatus: "extracted" | "inferred" | "missing" | "not_found" | string;
  confidence: number | null | undefined;
  sectionWindow: SectionTextWindow;
}): EvidenceFidelityLevel {
  const { extractionStatus, confidence, sectionWindow } = params;

  if (sectionWindow.narrowed) {
    if (extractionStatus === "extracted") return "explicit_section";
    if (extractionStatus === "inferred") return "inferred_section";
    return "inferred_section";
  }

  // Full-document extraction
  if (extractionStatus === "extracted") {
    if ((confidence ?? 0) >= 0.8) return "explicit_subdocument";
    if ((confidence ?? 0) >= 0.5) return "cross_section_inference";
  }
  return "global_context_guess";
}

// ─── String field merge ───────────────────────────────────────────────────────

/**
 * Merge two nullable string values, returning whichever has higher fidelity.
 * When fidelity is equal, the existing (stable) value wins unless it is null.
 */
export function mergeByFidelity(
  existing: EvidenceTaggedValue<string>,
  incoming: EvidenceTaggedValue<string>,
): EvidenceTaggedValue<string> {
  if (!incoming.value) return existing;
  if (!existing.value) return incoming;

  if (isHigherFidelity(incoming.fidelity, existing.fidelity)) return incoming;
  return existing;
}

/**
 * Merge two nullable string values, returning the higher-fidelity one.
 * Convenience wrapper for callers that don't need EvidenceTaggedValue.
 */
export function pickByFidelity(
  existingValue: string | null | undefined,
  existingFidelity: EvidenceFidelityLevel,
  incomingValue: string | null | undefined,
  incomingFidelity: EvidenceFidelityLevel,
): string | null | undefined {
  if (!incomingValue) return existingValue;
  if (!existingValue) return incomingValue;
  return isHigherFidelity(incomingFidelity, existingFidelity) ? incomingValue : existingValue;
}

// ─── Section fidelity summary ─────────────────────────────────────────────────

export interface SectionFidelitySummary {
  /** How many fields were extracted from a narrowed section window. */
  explicitSectionFields: number;
  /** How many fields fell back to global-document inference. */
  globalGuessFields: number;
  /** The narrowing method used for this section. */
  sliceMethod: SectionTextWindow["method"];
  /** Whether the text was genuinely narrowed for this pass. */
  textNarrowed: boolean;
  /** Ratio of section text length to full document length (0–1). */
  coverageRatio: number;
}

export function buildSectionFidelitySummary(
  sectionWindow: SectionTextWindow,
  fullTextLength: number,
  explicitCount: number,
  globalCount: number,
): SectionFidelitySummary {
  return {
    explicitSectionFields: explicitCount,
    globalGuessFields: globalCount,
    sliceMethod: sectionWindow.method,
    textNarrowed: sectionWindow.narrowed,
    coverageRatio: fullTextLength > 0
      ? (sectionWindow.endOffset - sectionWindow.startOffset) / fullTextLength
      : 1,
  };
}

// ─── Investment data merge with fidelity ─────────────────────────────────────

/**
 * Merge investment field from section-local extraction into envelope's existing value.
 *
 * Rules:
 * - Section-local (narrowed window) always wins over full-doc value if present
 * - Contractual data wins over modeled data at equal fidelity
 * - Never replace a present contractual value with a modeled/estimated one
 */
export function mergeInvestmentField<T>(
  existing: T | null | undefined,
  incomingFromSection: T | null | undefined,
  incomingIsContractual: boolean,
  existingIsContractual: boolean,
  sectionNarrowed: boolean,
): T | null | undefined {
  if (!incomingFromSection) return existing;
  if (!existing) return incomingFromSection;

  // Contractual data always beats modeled/estimated
  if (incomingIsContractual && !existingIsContractual) return incomingFromSection;
  if (!incomingIsContractual && existingIsContractual) return existing;

  // Both contractual or both modeled: prefer section-local if narrowed
  if (sectionNarrowed && incomingIsContractual) return incomingFromSection;

  return existing;
}
