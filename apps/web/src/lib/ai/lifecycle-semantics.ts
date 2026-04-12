/**
 * Generic lifecycle / finality semantics for AI Review (no vendor or filename rules).
 *
 * Business rules:
 * - Návrh / nabídka (proposal, offer) = finální vstup pro extrakci — nejsou automaticky modelace.
 * - Modelace / kalkulace / ilustrace / nezávazná projekce = nefinální projekce.
 * - CRM apply barrier se vztahuje na modelaci (typ dokumentu + lifecycle), ne na běžný návrh/nabídku.
 */

/** Lifecycle values that mean a non-binding projection (not a proposal/offer ready for closing). */
export const LIFECYCLE_NON_FINAL_PROJECTION = new Set<string>([
  "modelation",
  "illustration",
  "non_binding_projection",
]);

/** Lifecycle values that denote a final input for extraction (signed contract, proposal, offer, annex, …). */
export const LIFECYCLE_FINAL_INPUT = new Set<string>([
  "final_contract",
  "proposal",
  "offer",
  "confirmation",
  "annex",
  "endorsement_request",
  "policy_change_request",
]);

export function isLifecycleNonFinalProjection(lc: string | undefined | null): boolean {
  if (lc == null || lc === "") return false;
  return LIFECYCLE_NON_FINAL_PROJECTION.has(String(lc).trim().toLowerCase());
}

export function isLifecycleFinalInput(lc: string | undefined | null): boolean {
  if (lc == null || lc === "") return false;
  return LIFECYCLE_FINAL_INPUT.has(String(lc).trim().toLowerCase());
}

/**
 * Primary types that represent modelation / projection documents for apply barriers.
 * Excludes life_insurance_proposal and liability_insurance_offer (finální vstup).
 */
export const PRIMARY_TYPES_MODELATION_NON_FINAL = new Set<string>([
  "insurance_modelation",
  "life_insurance_modelation",
  "investment_modelation",
]);
