/**
 * Derives the canonical DocumentOutputMode from a pipeline's classification result.
 * Pure function — no LLM, no I/O.
 *
 * The four modes mirror the golden dataset truth (scenarios.manifest.json).
 * Used by:
 *  - live eval harness (golden-dataset-live-pipeline.eval.test.ts)
 *  - golden-dataset-manifest.test.ts (via manifest validation)
 *  - Future: envelope post-processing in the V2 pipeline
 */

export type DocumentOutputMode =
  | "structured_product_document"
  | "signature_ready_proposal"
  | "modelation_or_precontract"
  | "reference_or_supporting_document";

export const DOCUMENT_OUTPUT_MODES = [
  "structured_product_document",
  "signature_ready_proposal",
  "modelation_or_precontract",
  "reference_or_supporting_document",
] as const satisfies DocumentOutputMode[];

/**
 * Primary types that always map to reference_or_supporting_document.
 *
 * Rule: if a document does not aim at creating/amending a structured product record
 * in CRM, it belongs in the reference lane regardless of lifecycle status.
 *
 * Notably: insurance_policy_change_or_service_doc is a service doc (no greenfield
 * contract publish), consent_or_declaration is regulatory/AML/FATCA.
 */
const REFERENCE_PRIMARY_TYPES = new Set<string>([
  "bank_statement",
  "payslip_document",
  "income_proof_document",
  "income_confirmation",
  "corporate_tax_return",
  "self_employed_tax_or_income_document",
  "financial_analysis_document",
  "medical_questionnaire",
  "consent_or_declaration",
  "identity_document",
  "insurance_policy_change_or_service_doc",
  "service_agreement",
]);

/**
 * Primary types that always map to modelation_or_precontract.
 *
 * Note: precontract_information covers non-life "Informace o produktu" documents
 * and any disclosure forms that are NOT a binding offer or contract.
 */
const MODELATION_PRIMARY_TYPES = new Set<string>([
  "life_insurance_modelation",
  "investment_modelation",
  "precontract_information",
]);

const MODELATION_LIFECYCLES = new Set<string>([
  "modelation",
  "illustration",
  "non_binding_projection",
]);

const REFERENCE_LIFECYCLES = new Set<string>([
  "tax_return",
  "tax_or_income_proof",
  "payroll_statement",
  "income_proof",
  "onboarding_form",
]);

/** Proposal lifecycles that flag a document as signature_ready_proposal. */
const PROPOSAL_LIFECYCLES = new Set<string>(["proposal", "offer"]);

/**
 * Primary types that always map to signature_ready_proposal regardless of
 * lifecycle string (e.g. if the classifier returns "final_contract" for a life_insurance_proposal).
 */
const PROPOSAL_PRIMARY_TYPES = new Set<string>([
  "life_insurance_proposal",
  "liability_insurance_offer",
]);

/**
 * Derives the canonical output mode.
 *
 * Precedence (highest to lowest):
 * 1. Modelation primary type or modelation-class lifecycle
 * 2. Reference/supporting primary type
 * 3. Reference lifecycle
 * 4. nonlife_insurance_contract with proposal/offer lifecycle → signature_ready_proposal
 * 5. Proposal primary type
 * 6. Proposal lifecycle for non-final types
 * 7. Default → structured_product_document
 */
export function deriveOutputModeFromPrimary(
  primaryType: string,
  lifecycleStatus: string,
): DocumentOutputMode {
  const pt = (primaryType ?? "").toLowerCase();
  const lc = (lifecycleStatus ?? "").toLowerCase();

  if (MODELATION_PRIMARY_TYPES.has(pt) || MODELATION_LIFECYCLES.has(lc)) {
    return "modelation_or_precontract";
  }

  if (REFERENCE_PRIMARY_TYPES.has(pt)) {
    return "reference_or_supporting_document";
  }

  if (REFERENCE_LIFECYCLES.has(lc)) {
    return "reference_or_supporting_document";
  }

  if (pt === "nonlife_insurance_contract" && PROPOSAL_LIFECYCLES.has(lc)) {
    return "signature_ready_proposal";
  }

  if (PROPOSAL_PRIMARY_TYPES.has(pt)) {
    return "signature_ready_proposal";
  }

  if (PROPOSAL_LIFECYCLES.has(lc)) {
    const isClearlyFinal =
      pt.includes("final_contract") ||
      pt === "consumer_loan_contract" ||
      pt === "mortgage_document" ||
      pt === "pension_contract" ||
      pt.startsWith("investment_") ||
      pt === "generic_financial_document";

    if (!isClearlyFinal) {
      return "signature_ready_proposal";
    }
  }

  return "structured_product_document";
}

/**
 * Returns true when an outputMode mismatch is acceptable — e.g. when golden
 * expects "structured_product_document" and pipeline returns "signature_ready_proposal"
 * (proposal documents may be upgraded once data completeness is confirmed).
 *
 * Hard failures:
 * - reference doc classified as structured or proposal
 * - modelation classified as structured or proposal
 * - structured/proposal classified as reference (loss of data)
 */
export function outputModeMatchOk(
  expected: DocumentOutputMode,
  actual: DocumentOutputMode,
): boolean {
  if (expected === actual) return true;

  // Modelation must not leak into final lanes
  if (expected === "modelation_or_precontract") {
    return false;
  }

  // Reference must not be routed into product lanes
  if (expected === "reference_or_supporting_document") {
    return actual === "reference_or_supporting_document";
  }

  // structured ↔ signature_ready is an acceptable near-match
  // (the same document may be final or proposal depending on pipeline signal)
  if (
    (expected === "structured_product_document" && actual === "signature_ready_proposal") ||
    (expected === "signature_ready_proposal" && actual === "structured_product_document")
  ) {
    return true;
  }

  return false;
}
