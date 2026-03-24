/**
 * Plan 3 §7 — normalized taxonomy for reporting, trace, and external APIs.
 * Internal extraction still uses PrimaryDocumentType + schema registry.
 */

import type { PrimaryDocumentType } from "./document-review-types";

export const NORMALIZED_DOCUMENT_TYPES = [
  "insurance_contract_risk_life",
  "insurance_contract_investment_life",
  "insurance_contract_other",
  "insurance_proposal",
  "insurance_change_or_amendment",
  "insurance_model_or_illustration",
  "payment_instruction",
  "loan_contract",
  "loan_supporting_document",
  "bank_statement",
  "income_verification",
  "financial_analysis_document",
  "general_terms_or_appendix",
  "unknown",
] as const;

export type NormalizedDocumentType = (typeof NORMALIZED_DOCUMENT_TYPES)[number];

export function mapPrimaryToNormalized(primary: PrimaryDocumentType): NormalizedDocumentType {
  switch (primary) {
    case "life_insurance_final_contract":
    case "life_insurance_contract":
    case "nonlife_insurance_contract":
      return "insurance_contract_risk_life";
    case "life_insurance_investment_contract":
      return "insurance_contract_investment_life";
    case "life_insurance_proposal":
      return "insurance_proposal";
    case "life_insurance_change_request":
    case "insurance_policy_change_or_service_doc":
      return "insurance_change_or_amendment";
    case "life_insurance_modelation":
    case "investment_modelation":
      return "insurance_model_or_illustration";
    case "payment_instruction":
    case "investment_payment_instruction":
    case "payment_schedule":
      return "payment_instruction";
    case "consumer_loan_contract":
    case "consumer_loan_with_payment_protection":
    case "mortgage_document":
      return "loan_contract";
    case "pension_contract":
    case "investment_subscription_document":
      return "loan_supporting_document";
    case "bank_statement":
      return "bank_statement";
    case "payslip_document":
    case "income_proof_document":
    case "income_confirmation":
    case "corporate_tax_return":
    case "self_employed_tax_or_income_document":
      return "income_verification";
    case "financial_analysis_document":
      return "financial_analysis_document";
    case "precontract_information":
    case "consent_or_declaration":
    case "service_agreement":
    case "liability_insurance_offer":
      return "general_terms_or_appendix";
    case "investment_service_agreement":
      return "insurance_contract_other";
    case "insurance_comparison":
    case "medical_questionnaire":
    case "identity_document":
    case "generic_financial_document":
    case "unsupported_or_unknown":
      return "unknown";
    default:
      return "unknown";
  }
}

export function isNormalizedDocumentType(value: string): value is NormalizedDocumentType {
  return (NORMALIZED_DOCUMENT_TYPES as readonly string[]).includes(value);
}
