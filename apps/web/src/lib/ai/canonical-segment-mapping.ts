/**
 * Canonical bidirectional lookup: contractSegment ↔ PrimaryDocumentType.
 *
 * Rule: one segment can map to multiple primaryTypes (e.g. ZP has final/proposal/modelation).
 * The SEGMENT_TO_PRIMARY_TYPE lookup returns the *representative* primaryType per segment —
 * used when creating a contract row without a classified document.
 * The PRIMARY_TYPE_TO_SEGMENT lookup is the inverse, used when deriving segment from a
 * classified document's primaryType.
 *
 * Design constraints:
 * - No vendor-specific or filename-specific logic.
 * - Additive; adding a new segment or primaryType does not break existing mappings.
 * - Single source-of-truth for all layers (apply, projections, portal, CRM).
 */

import type { PrimaryDocumentType } from "./document-review-types";
import { CONTRACT_SEGMENT_CODES } from "@/lib/contracts/contract-segment-wizard-config";

export type ContractSegment = (typeof CONTRACT_SEGMENT_CODES)[number];

// ─── Segment → representative primaryType ────────────────────────────────────
// "Representative" = the final-contract variant; used when a segment code must be
// translated to a primaryType for routing or display purposes.

export const SEGMENT_TO_PRIMARY_TYPE: Record<ContractSegment, PrimaryDocumentType> = {
  ZP: "life_insurance_contract",
  MAJ: "nonlife_insurance_contract",
  ODP: "nonlife_insurance_contract",
  ODP_ZAM: "liability_insurance_offer",
  AUTO_PR: "nonlife_insurance_contract",
  AUTO_HAV: "nonlife_insurance_contract",
  CEST: "nonlife_insurance_contract",
  INV: "investment_service_agreement",
  DIP: "investment_subscription_document",
  DPS: "pension_contract",
  HYPO: "mortgage_document",
  UVER: "consumer_loan_contract",
  FIRMA_POJ: "nonlife_insurance_contract",
};

// ─── PrimaryType → segment ────────────────────────────────────────────────────
// Maps every known primaryType to its canonical contractSegment.
// When a primaryType can belong to multiple segments (e.g. nonlife_insurance_contract
// covers MAJ/ODP/AUTO/CEST/FIRMA_POJ), we use the most generic applicable segment (MAJ)
// as fallback; the caller may override based on sub-type/family signals.

export const PRIMARY_TYPE_TO_SEGMENT: Partial<Record<PrimaryDocumentType, ContractSegment>> = {
  // Life insurance
  life_insurance_final_contract: "ZP",
  life_insurance_contract: "ZP",
  life_insurance_investment_contract: "ZP",
  life_insurance_proposal: "ZP",
  life_insurance_change_request: "ZP",
  life_insurance_modelation: "ZP",
  // Non-life (generic fallback = MAJ)
  nonlife_insurance_contract: "MAJ",
  liability_insurance_offer: "ODP",
  precontract_information: "MAJ",
  insurance_policy_change_or_service_doc: "MAJ",
  insurance_comparison: "MAJ",
  // Investment
  investment_service_agreement: "INV",
  investment_subscription_document: "DIP",
  investment_modelation: "INV",
  investment_payment_instruction: "INV",
  // Pension / DPS
  pension_contract: "DPS",
  // Loans / mortgage
  mortgage_document: "HYPO",
  consumer_loan_contract: "UVER",
  consumer_loan_with_payment_protection: "UVER",
  // Supporting / generic — no canonical segment; callers must handle null
};

// ─── Full set of primaryTypes per segment ────────────────────────────────────
// Useful for filtering or validation: "which primaryTypes are valid for segment X?"

export const SEGMENT_PRIMARY_TYPE_SET: Record<ContractSegment, ReadonlySet<PrimaryDocumentType>> = {
  ZP: new Set([
    "life_insurance_final_contract",
    "life_insurance_contract",
    "life_insurance_investment_contract",
    "life_insurance_proposal",
    "life_insurance_change_request",
    "life_insurance_modelation",
  ]),
  MAJ: new Set([
    "nonlife_insurance_contract",
    "precontract_information",
    "insurance_comparison",
    "insurance_policy_change_or_service_doc",
  ]),
  ODP: new Set([
    "nonlife_insurance_contract",
    "liability_insurance_offer",
    "precontract_information",
    "insurance_policy_change_or_service_doc",
  ]),
  ODP_ZAM: new Set([
    "nonlife_insurance_contract",
    "liability_insurance_offer",
    "precontract_information",
    "insurance_policy_change_or_service_doc",
  ]),
  AUTO_PR: new Set([
    "nonlife_insurance_contract",
    "precontract_information",
    "insurance_policy_change_or_service_doc",
  ]),
  AUTO_HAV: new Set([
    "nonlife_insurance_contract",
    "precontract_information",
    "insurance_policy_change_or_service_doc",
  ]),
  CEST: new Set([
    "nonlife_insurance_contract",
    "precontract_information",
  ]),
  INV: new Set([
    "investment_service_agreement",
    "investment_modelation",
    "investment_payment_instruction",
  ]),
  DIP: new Set([
    "investment_subscription_document",
  ]),
  DPS: new Set([
    "pension_contract",
  ]),
  HYPO: new Set([
    "mortgage_document",
  ]),
  UVER: new Set([
    "consumer_loan_contract",
    "consumer_loan_with_payment_protection",
  ]),
  FIRMA_POJ: new Set([
    "nonlife_insurance_contract",
    "insurance_policy_change_or_service_doc",
  ]),
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Returns the canonical contractSegment for a given primaryType.
 * Returns `null` for supporting/generic types that have no segment mapping.
 */
export function segmentFromPrimaryType(primaryType: PrimaryDocumentType): ContractSegment | null {
  return PRIMARY_TYPE_TO_SEGMENT[primaryType] ?? null;
}

/**
 * Returns the representative primaryType for a given contractSegment.
 */
export function primaryTypeFromSegment(segment: ContractSegment): PrimaryDocumentType {
  return SEGMENT_TO_PRIMARY_TYPE[segment];
}

/**
 * Returns true when `primaryType` is a valid document type for `segment`.
 */
export function isPrimaryTypeValidForSegment(
  primaryType: PrimaryDocumentType,
  segment: ContractSegment
): boolean {
  return SEGMENT_PRIMARY_TYPE_SET[segment].has(primaryType);
}
