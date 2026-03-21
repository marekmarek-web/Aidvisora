import { z } from "zod";
import {
  DOCUMENT_LIFECYCLE_STATUSES,
  PRIMARY_DOCUMENT_TYPES,
  type DocumentLifecycleStatus,
  type DocumentReviewEnvelope,
  documentReviewEnvelopeSchema,
} from "./document-review-types";

export type DocumentFieldRuleSet = {
  required: string[];
  optional: string[];
  conditional: string[];
  notApplicableRules: string[];
  matchingKeys: string[];
  crmMappingTarget: string;
  reviewRules: string[];
  suggestedActionRules: string[];
};

export type DocumentSchemaDefinition = {
  primaryType: (typeof PRIMARY_DOCUMENT_TYPES)[number];
  allowedLifecycle: DocumentLifecycleStatus[];
  subtypeHints: string[];
  extractionRules: DocumentFieldRuleSet;
};

const commonOptional = [
  "documentMeta.issuer",
  "documentMeta.documentDate",
  "documentMeta.language",
  "documentMeta.pageCount",
];

export const DOCUMENT_SCHEMA_REGISTRY: Record<
  (typeof PRIMARY_DOCUMENT_TYPES)[number],
  DocumentSchemaDefinition
> = {
  life_insurance_contract: {
    primaryType: "life_insurance_contract",
    allowedLifecycle: ["final_contract", "annex", "unknown"],
    subtypeHints: ["generali_bel_mondo", "uniqa_domino_risk", "maxima_maxefekt"],
    extractionRules: {
      required: [
        "extractedFields.insurer",
        "extractedFields.productName",
        "extractedFields.documentStatus",
        "extractedFields.policyStartDate",
      ],
      optional: [
        "extractedFields.policyEndDate",
        "extractedFields.totalMonthlyPremium",
        "extractedFields.coverages",
        "extractedFields.riders",
        ...commonOptional,
      ],
      conditional: [
        "extractedFields.contractNumber_or_proposalNumber",
        "extractedFields.bankPaymentInfo_if_present",
      ],
      notApplicableRules: [
        "collateral is not_applicable for life insurance unless explicit",
        "companyId not required for natural persons",
      ],
      matchingKeys: [
        "fullName",
        "birthDate",
        "maskedPersonalId",
        "email",
        "phone",
        "address",
        "householdMembers",
      ],
      crmMappingTarget: "contracts(segment=ZP)",
      reviewRules: [
        "proposal must never be marked as final contract",
        "nesjednano values map to explicitly_not_selected",
        "broker fields must not be merged into client contacts",
      ],
      suggestedActionRules: [
        "create_or_link_client",
        "create_contract_record",
        "create_task",
        "request_manual_review_on_ambiguity",
      ],
    },
  },
  life_insurance_proposal: {
    primaryType: "life_insurance_proposal",
    allowedLifecycle: ["proposal", "offer", "unknown"],
    subtypeHints: ["generali_bel_mondo", "uniqa_domino_risk", "maxima_maxefekt"],
    extractionRules: {
      required: [
        "extractedFields.insurer",
        "extractedFields.productName",
        "extractedFields.documentStatus",
        "extractedFields.proposalNumber_or_contractNumber",
      ],
      optional: [
        "extractedFields.totalMonthlyPremium",
        "extractedFields.coverages",
        "extractedFields.riders",
        ...commonOptional,
      ],
      conditional: ["extractedFields.policyStartDate_if_present"],
      notApplicableRules: ["contractSignedDate may be not_applicable for proposal"],
      matchingKeys: ["fullName", "birthDate", "maskedPersonalId", "email", "phone"],
      crmMappingTarget: "opportunities(segment=ZP)",
      reviewRules: ["proposal not final contract"],
      suggestedActionRules: [
        "create_or_link_client",
        "create_opportunity",
        "create_task_followup",
      ],
    },
  },
  consumer_loan_contract: {
    primaryType: "consumer_loan_contract",
    allowedLifecycle: ["final_contract", "annex", "unknown"],
    subtypeHints: ["moneta_expres_pujcka", "csob_consumer_loan"],
    extractionRules: {
      required: [
        "extractedFields.lender",
        "extractedFields.contractNumber",
        "extractedFields.loanAmount",
        "extractedFields.installmentAmount",
      ],
      optional: [
        "extractedFields.rpsn",
        "extractedFields.totalPayable",
        "extractedFields.accountForRepayment",
        "extractedFields.relatedBankAccount",
        ...commonOptional,
      ],
      conditional: ["extractedFields.collateral_if_secured_loan"],
      notApplicableRules: ["companyId not required for natural person borrower"],
      matchingKeys: ["fullName", "birthDate", "maskedPersonalId", "address", "phone", "email"],
      crmMappingTarget: "contracts(segment=UVER)",
      reviewRules: ["distinguish missing vs not_applicable for collateral"],
      suggestedActionRules: [
        "create_or_link_client",
        "create_contract_record",
        "create_task",
      ],
    },
  },
  consumer_loan_with_payment_protection: {
    primaryType: "consumer_loan_with_payment_protection",
    allowedLifecycle: ["final_contract", "proposal", "annex", "unknown"],
    subtypeHints: ["moneta_payment_protection", "csob_loan_ppi"],
    extractionRules: {
      required: [
        "extractedFields.lender",
        "extractedFields.contractNumber",
        "extractedFields.loanAmount",
        "extractedFields.paymentProtectionProvider",
        "extractedFields.insuredRisks",
      ],
      optional: [
        "extractedFields.monthlyInsuranceCharge",
        "extractedFields.insuranceStart",
        "extractedFields.insuranceEnd",
        "extractedFields.claimsConditions",
        ...commonOptional,
      ],
      conditional: ["extractedFields.medicalConsentPresent_if_declared"],
      notApplicableRules: ["collateral may be not_applicable for unsecured loans"],
      matchingKeys: ["fullName", "birthDate", "maskedPersonalId", "address", "phone", "email"],
      crmMappingTarget: "contracts(segment=UVER)+insurance_link",
      reviewRules: ["do not treat insurance section as standalone contract unless explicit"],
      suggestedActionRules: [
        "create_or_link_client",
        "create_contract_record",
        "create_task_review_insurance",
      ],
    },
  },
  mortgage_document: {
    primaryType: "mortgage_document",
    allowedLifecycle: [...DOCUMENT_LIFECYCLE_STATUSES],
    subtypeHints: ["mortgage_annex", "mortgage_offer"],
    extractionRules: {
      required: ["extractedFields.lender", "extractedFields.documentStatus"],
      optional: ["extractedFields.loanAmount", "extractedFields.interestRate", ...commonOptional],
      conditional: ["extractedFields.collateral_if_present"],
      notApplicableRules: ["for pure annex product fields may be not_applicable"],
      matchingKeys: ["fullName", "birthDate", "maskedPersonalId", "address"],
      crmMappingTarget: "contracts(segment=HYPO)",
      reviewRules: ["annex must not overwrite final contract data without review"],
      suggestedActionRules: ["create_or_link_client", "create_task_manual_review"],
    },
  },
  income_confirmation: {
    primaryType: "income_confirmation",
    allowedLifecycle: ["confirmation", "unknown"],
    subtypeHints: ["csob_income_confirmation", "employer_income_confirmation"],
    extractionRules: {
      required: [
        "extractedFields.employerName",
        "extractedFields.employeeFullName",
        "extractedFields.issueDate",
      ],
      optional: [
        "extractedFields.averageNetIncomeLast3Months",
        "extractedFields.averageNetIncomeLast12Months",
        "extractedFields.employerStampPresent",
        ...commonOptional,
      ],
      conditional: ["extractedFields.wageDeductionsDetail_if_deductions_true"],
      notApplicableRules: ["not a final contract or product agreement"],
      matchingKeys: ["employeeFullName", "employeeBirthDate", "address", "employerName"],
      crmMappingTarget: "documents+income_verification",
      reviewRules: ["mark as income verification document"],
      suggestedActionRules: [
        "attach_to_existing_client",
        "create_income_verification_record",
        "propose_financial_analysis_update",
      ],
    },
  },
  bank_statement: {
    primaryType: "bank_statement",
    allowedLifecycle: ["statement", "unknown"],
    subtypeHints: ["csob_bank_statement", "moneta_bank_statement"],
    extractionRules: {
      required: [
        "extractedFields.bankName",
        "extractedFields.accountOwner",
        "extractedFields.statementPeriodFrom",
        "extractedFields.statementPeriodTo",
      ],
      optional: [
        "extractedFields.openingBalance",
        "extractedFields.closingBalance",
        "extractedFields.transactionsSummary",
        "extractedFields.recurringPayments",
        ...commonOptional,
      ],
      conditional: ["extractedFields.detectedLoanPayments_if_present"],
      notApplicableRules: ["raw transaction dump is not_applicable for regular CRM review"],
      matchingKeys: ["accountOwner", "accountName", "address", "ibanMasked"],
      crmMappingTarget: "documents+cashflow_summary",
      reviewRules: ["high sensitivity handling required"],
      suggestedActionRules: [
        "attach_to_existing_client",
        "request_manual_review",
        "propose_financial_analysis_update",
      ],
    },
  },
  investment_service_agreement: {
    primaryType: "investment_service_agreement",
    allowedLifecycle: ["onboarding_form", "final_contract", "proposal", "unknown"],
    subtypeHints: ["codya_invest_service_agreement"],
    extractionRules: {
      required: [
        "extractedFields.companyName",
        "extractedFields.serviceType",
        "extractedFields.investorFullName",
      ],
      optional: [
        "extractedFields.fatcaStatus",
        "extractedFields.communicationPreferences",
        "extractedFields.onlineAccessServices",
        ...commonOptional,
      ],
      conditional: ["extractedFields.qualifiedInvestorDeclaration_if_present"],
      notApplicableRules: ["document may be onboarding without product holding"],
      matchingKeys: ["investorFullName", "birthDate", "maskedPersonalId", "email", "phone"],
      crmMappingTarget: "investment_onboarding",
      reviewRules: ["must not be auto-labeled as investment product contract"],
      suggestedActionRules: [
        "create_or_link_client",
        "create_task_onboarding",
        "create_opportunity",
      ],
    },
  },
  investment_subscription_document: {
    primaryType: "investment_subscription_document",
    allowedLifecycle: ["proposal", "final_contract", "onboarding_form", "unknown"],
    subtypeHints: ["fund_subscription", "investment_order_form"],
    extractionRules: {
      required: ["extractedFields.investorFullName", "extractedFields.productName"],
      optional: ["extractedFields.contributionAmount", ...commonOptional],
      conditional: ["extractedFields.signedDate_if_present"],
      notApplicableRules: ["bank-statement specific fields are not_applicable"],
      matchingKeys: ["investorFullName", "birthDate", "maskedPersonalId", "email"],
      crmMappingTarget: "contracts(segment=INV)",
      reviewRules: ["ensure lifecycle not misclassified as final when proposal"],
      suggestedActionRules: ["create_or_link_client", "create_contract_record", "create_task"],
    },
  },
  liability_insurance_offer: {
    primaryType: "liability_insurance_offer",
    allowedLifecycle: ["offer", "proposal", "unknown"],
    subtypeHints: ["employer_liability_offer"],
    extractionRules: {
      required: ["extractedFields.offerType", "extractedFields.productArea"],
      optional: [
        "extractedFields.insurer",
        "extractedFields.premium",
        "extractedFields.paymentFrequency",
        "extractedFields.coverageLimit",
        "extractedFields.deductible",
        ...commonOptional,
      ],
      conditional: ["extractedFields.offerValidDate_if_present"],
      notApplicableRules: ["bindingContract should be false by default"],
      matchingKeys: ["insuredPersonName", "yearOfBirth", "brokerName"],
      crmMappingTarget: "opportunities(segment=ODP)",
      reviewRules: ["must not be represented as signed contract"],
      suggestedActionRules: [
        "create_or_link_client",
        "create_opportunity",
        "create_task_followup",
      ],
    },
  },
  insurance_comparison: {
    primaryType: "insurance_comparison",
    allowedLifecycle: ["comparison", "offer", "unknown"],
    subtypeHints: ["insurance_market_comparison"],
    extractionRules: {
      required: ["extractedFields.offerType", "extractedFields.productArea"],
      optional: ["extractedFields.includedRiders", "extractedFields.packageName", ...commonOptional],
      conditional: ["extractedFields.coverageLimit_if_present"],
      notApplicableRules: ["bindingContract is always false for comparison docs"],
      matchingKeys: ["insuredPersonName", "yearOfBirth", "brokerName"],
      crmMappingTarget: "opportunities(segment=ODP)",
      reviewRules: ["comparison never equals final contract"],
      suggestedActionRules: ["create_opportunity", "create_task_followup"],
    },
  },
  service_agreement: {
    primaryType: "service_agreement",
    allowedLifecycle: ["final_contract", "onboarding_form", "unknown"],
    subtypeHints: ["service_contract", "advisory_agreement"],
    extractionRules: {
      required: ["extractedFields.companyName_or_provider", "extractedFields.investorFullName_or_clientName"],
      optional: ["extractedFields.serviceAgreementStatus", "extractedFields.signedDate", ...commonOptional],
      conditional: ["extractedFields.partnerCompany_if_present"],
      notApplicableRules: ["product obligation fields may be not_applicable"],
      matchingKeys: ["fullName", "birthDate", "maskedPersonalId", "address", "email"],
      crmMappingTarget: "documents+service_relation",
      reviewRules: ["service agreement is not automatically an investment position"],
      suggestedActionRules: ["create_or_link_client", "create_task"],
    },
  },
  generic_financial_document: {
    primaryType: "generic_financial_document",
    allowedLifecycle: [...DOCUMENT_LIFECYCLE_STATUSES],
    subtypeHints: ["generic_financial_document"],
    extractionRules: {
      required: ["extractedFields.documentSummary"],
      optional: [...commonOptional, "extractedFields.primaryParties", "extractedFields.financialTerms"],
      conditional: [],
      notApplicableRules: ["type-specific required fields are not_applicable unless inferred with confidence"],
      matchingKeys: ["fullName", "birthDate", "email", "phone", "address"],
      crmMappingTarget: "documents",
      reviewRules: ["force manual review on low confidence"],
      suggestedActionRules: ["request_manual_review", "attach_to_existing_client"],
    },
  },
  unsupported_or_unknown: {
    primaryType: "unsupported_or_unknown",
    allowedLifecycle: ["unknown"],
    subtypeHints: ["unsupported_or_unknown"],
    extractionRules: {
      required: [],
      optional: ["extractedFields.documentSummary", ...commonOptional],
      conditional: [],
      notApplicableRules: ["all finance-specific fields are not_applicable"],
      matchingKeys: [],
      crmMappingTarget: "documents",
      reviewRules: ["do not hallucinate unavailable text"],
      suggestedActionRules: ["request_manual_review"],
    },
  },
};

function toLifecycle(
  raw: unknown,
  fallback: DocumentLifecycleStatus
): DocumentLifecycleStatus {
  const t = String(raw ?? "").trim();
  if ((DOCUMENT_LIFECYCLE_STATUSES as readonly string[]).includes(t)) {
    return t as DocumentLifecycleStatus;
  }
  return fallback;
}

export function classifyLifecycleFromPrimary(
  primaryType: (typeof PRIMARY_DOCUMENT_TYPES)[number],
  proposed?: unknown
): DocumentLifecycleStatus {
  const fallbackMap: Record<(typeof PRIMARY_DOCUMENT_TYPES)[number], DocumentLifecycleStatus> = {
    life_insurance_contract: "final_contract",
    life_insurance_proposal: "proposal",
    consumer_loan_contract: "final_contract",
    consumer_loan_with_payment_protection: "final_contract",
    mortgage_document: "unknown",
    income_confirmation: "confirmation",
    bank_statement: "statement",
    investment_service_agreement: "onboarding_form",
    investment_subscription_document: "proposal",
    liability_insurance_offer: "offer",
    insurance_comparison: "comparison",
    service_agreement: "final_contract",
    generic_financial_document: "unknown",
    unsupported_or_unknown: "unknown",
  };
  return toLifecycle(proposed, fallbackMap[primaryType]);
}

export function buildSchemaPrompt(
  schemaDef: DocumentSchemaDefinition,
  isScanFallback: boolean
): string {
  const scanHint = isScanFallback
    ? "Dokument je pravděpodobně scan. U nečitelných dat použij status inferred_low_confidence nebo not_found."
    : "";
  return `Jsi extrakční engine pro finanční dokumenty.\n${scanHint}\n\n` +
    `Dokument klasifikace:\n` +
    `- primaryType: ${schemaDef.primaryType}\n` +
    `- allowedLifecycle: ${schemaDef.allowedLifecycle.join(", ")}\n` +
    `- subtypeHints: ${schemaDef.subtypeHints.join(", ")}\n\n` +
    `Vrať JEDINĚ platný JSON dle struktury DocumentReviewEnvelope:\n` +
    `- documentClassification{primaryType, subtype, lifecycleStatus, confidence, reasons}\n` +
    `- documentMeta{fileName,pageCount,issuer,documentDate,language,scannedVsDigital,overallConfidence}\n` +
    `- parties{}\n` +
    `- productsOrObligations[]\n` +
    `- financialTerms{}\n` +
    `- serviceTerms{}\n` +
    `- extractedFields{ [fieldKey]: {value, confidence, sourcePage, evidenceSnippet, status, sensitive?} }\n` +
    `- evidence[]\n` +
    `- candidateMatches{matchedClients,matchedHouseholds,matchedDeals,score,reason,ambiguityFlags}\n` +
    `- reviewWarnings[]\n` +
    `- suggestedActions[]\n` +
    `- dataCompleteness\n` +
    `- sensitivityProfile\n\n` +
    `Rules:\n` +
    `- required fields: ${schemaDef.extractionRules.required.join(", ") || "none"}\n` +
    `- optional fields: ${schemaDef.extractionRules.optional.join(", ") || "none"}\n` +
    `- conditional fields: ${schemaDef.extractionRules.conditional.join(", ") || "none"}\n` +
    `- not applicable rules: ${schemaDef.extractionRules.notApplicableRules.join(" | ") || "none"}\n` +
    `- matching keys: ${schemaDef.extractionRules.matchingKeys.join(", ") || "none"}\n` +
    `- CRM mapping target: ${schemaDef.extractionRules.crmMappingTarget}\n` +
    `- review rules: ${schemaDef.extractionRules.reviewRules.join(" | ") || "none"}\n` +
    `- suggested action rules: ${schemaDef.extractionRules.suggestedActionRules.join(", ") || "none"}\n\n` +
    `Field status semantics:\n` +
    `- explicitly_not_selected použij pro \"nesjednáno\".\n` +
    `- not_applicable když pole pro tento typ dokumentu nedává smysl.\n` +
    `- missing když je pole required, ale chybí v dokumentu.\n` +
    `- not_found když dokument je relevantní, ale údaj se nepodařilo najít.\n`;
}

export function safeParseReviewEnvelope(raw: string): {
  ok: true;
  data: DocumentReviewEnvelope;
} | {
  ok: false;
  issues: z.ZodIssue[];
} {
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      issues: [{ code: "custom", path: [], message: e instanceof Error ? e.message : String(e) }],
    };
  }
  const result = documentReviewEnvelopeSchema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, issues: result.error.issues };
}

