/**
 * Generic semantic contract understanding for AI Review (bounded post-extraction pass).
 *
 * Applies product-type and lifecycle rules without vendor-specific hacks: finality flags,
 * institution deduplication, investment vs intermediary collisions, non-life vs empty
 * investment noise, annual vs monthly premium duplication when frequency is explicit,
 * and alignment of documentClassification.primaryType with strong structural signals
 * from extractedFields when routing/classifier output conflicts with the main contract.
 *
 * Runs after alias normalization and date/frequency normalization, before evidence tagging.
 */

import type { DocumentReviewEnvelope, ExtractedField, PrimaryDocumentType } from "./document-review-types";
import {
  extractFirstNumericAmount,
  nonlifeRiskPremiumHasExplicitSemantics,
} from "./payment-semantics";
import { isLifecycleFinalInput, isLifecycleNonFinalProjection } from "./lifecycle-semantics";
import {
  applySavingsInvestmentSemantics,
  promoteLooseFundAllocationToInvestmentFunds,
  promoteLooseIsinToCanonical,
} from "./savings-investment-semantics";
import { buildCanonicalPaymentPayload, isPaymentSyncReady } from "./payment-field-contract";

function isPresent(cell: ExtractedField | undefined): cell is ExtractedField {
  if (!cell) return false;
  if (cell.status === "missing" || cell.status === "not_found" || cell.status === "not_applicable") return false;
  const v = cell.value;
  if (v == null) return false;
  const s = String(v).trim();
  return s !== "" && s !== "—" && s !== "null";
}

function strEq(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase() && String(a ?? "").trim() !== "";
}

function approxEqualMoney(a: unknown, b: unknown): boolean {
  const na = extractFirstNumericAmount(a);
  const nb = extractFirstNumericAmount(b);
  if (na == null || nb == null) return false;
  const d = Math.abs(na - nb);
  const scale = Math.max(Math.abs(na), Math.abs(nb), 1);
  return d / scale < 0.02;
}

/** ISIN shape only (no issuer list — transferable to any instrument). */
export function isPlausibleIsin(value: unknown): boolean {
  const t = String(value ?? "")
    .replace(/\s/g, "")
    .toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{10}$/.test(t);
}

function hasVehicleSubjectSignals(ef: Record<string, ExtractedField | undefined>): boolean {
  return (
    isPresent(ef.vin) ||
    isPresent(ef.registrationPlate) ||
    isPresent(ef.brandModel) ||
    isPresent(ef.vehicleModel) ||
    isPresent(ef.vehicleBrand)
  );
}

function hasNonEmptyInvestmentFundsJson(ef: Record<string, ExtractedField | undefined>): boolean {
  const c = ef.investmentFunds;
  if (!c || !isPresent(c)) return false;
  const raw = String(c.value ?? "").trim();
  if (raw.length < 3 || raw === "[]" || raw === "{}") return false;
  if (raw.startsWith("[")) {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) && p.length > 0;
    } catch {
      return raw.length > 10;
    }
  }
  return raw.length > 5;
}

/** Vehicle / motor subject: registry fields, not insurer names. */
export function hasStrongVehicleSubjectSignals(ef: Record<string, ExtractedField | undefined>): boolean {
  return hasVehicleSubjectSignals(ef);
}

/** Investor + (ISIN or non-empty funds JSON) — structural investment contract signal. */
export function hasStrongInvestmentContractSignals(ef: Record<string, ExtractedField | undefined>): boolean {
  if (!isPresent(ef.investorFullName)) return false;
  if (isPlausibleIsin(ef.isin?.value)) return true;
  return hasNonEmptyInvestmentFundsJson(ef);
}

/** Účastník + poskytovatel — typické pro penzijní smlouvu/DPS, ne pro běžné životní. */
export function hasStrongPensionParticipantSignals(ef: Record<string, ExtractedField | undefined>): boolean {
  if (!isPresent(ef.participantFullName) || !isPresent(ef.provider)) return false;
  const contrib =
    isPresent(ef.contributionParticipant) ||
    isPresent(ef.mesicniPrispevek) ||
    isPresent(ef.monthlyContribution) ||
    (isPresent(ef.totalMonthlyPremium) && isPresent(ef.productName));
  return contrib;
}

/** Exported for bundle/orchestrator guards — finální smlouva má číslo, instituci a datum. */
export function hasFullContractShell(ef: Record<string, ExtractedField | undefined>): boolean {
  const hasRef = isPresent(ef.contractNumber) || isPresent(ef.proposalNumber);
  const hasInst = isPresent(ef.insurer) || isPresent(ef.institutionName) || isPresent(ef.provider);
  const hasDate =
    isPresent(ef.policyStartDate) ||
    isPresent(ef.effectiveDate) ||
    isPresent(ef.policyEndDate) ||
    isPresent(ef.dateSigned);
  return hasRef && hasInst && hasDate;
}

const VEHICLE_CONFLICT_PRIMARIES: PrimaryDocumentType[] = [
  "investment_subscription_document",
  "investment_service_agreement",
  "investment_modelation",
  "pension_contract",
  "generic_financial_document",
  "unsupported_or_unknown",
  "precontract_information",
];

const INVESTMENT_CONFLICT_PRIMARIES: PrimaryDocumentType[] = [
  "nonlife_insurance_contract",
  "liability_insurance_offer",
  "pension_contract",
  "generic_financial_document",
  "unsupported_or_unknown",
  "precontract_information",
];

const PENSION_CONFLICT_PRIMARIES: PrimaryDocumentType[] = [
  "investment_subscription_document",
  "investment_modelation",
  "nonlife_insurance_contract",
  "liability_insurance_offer",
  "generic_financial_document",
  "unsupported_or_unknown",
  "precontract_information",
];

const SUPPORTING_LIKE_PRIMARIES: PrimaryDocumentType[] = [
  "bank_statement",
  "payslip_document",
  "corporate_tax_return",
  "income_proof_document",
];

function reasonsPush(dc: DocumentReviewEnvelope["documentClassification"], code: string): void {
  const r = dc.reasons ?? [];
  if (!r.includes(code)) dc.reasons = [...r, code];
}

/**
 * When extracted fields contain strong structural signals, align primaryType with them
 * so review / validation / schema match the main contract — independent of a weak or wrong classifier.
 */
export function alignDocumentClassificationWithExtractedEvidence(envelope: DocumentReviewEnvelope): void {
  const dc = envelope.documentClassification;
  if (!dc) return;
  const ef = envelope.extractedFields as Record<string, ExtractedField | undefined>;
  const current = dc.primaryType;
  const vehicle = hasStrongVehicleSubjectSignals(ef);
  const invest = hasStrongInvestmentContractSignals(ef);
  const pension = hasStrongPensionParticipantSignals(ef) && !vehicle;
  const shell = hasFullContractShell(ef);
  const supportingMisroute = SUPPORTING_LIKE_PRIMARIES.includes(current) && shell;

  // Priority: explicit vehicle > investment > pension (mutually exclusive subjects in practice).
  if (vehicle && (VEHICLE_CONFLICT_PRIMARIES.includes(current) || (supportingMisroute && invest === false))) {
    dc.primaryType = "nonlife_insurance_contract";
    reasonsPush(dc, "semantic_alignment_vehicle_subject");
    return;
  }
  if (invest && !vehicle && INVESTMENT_CONFLICT_PRIMARIES.includes(current)) {
    dc.primaryType = "investment_subscription_document";
    reasonsPush(dc, "semantic_alignment_investment_isin_or_funds");
    return;
  }
  if (pension && !invest && PENSION_CONFLICT_PRIMARIES.includes(current)) {
    dc.primaryType = "pension_contract";
    reasonsPush(dc, "semantic_alignment_pension_participant_provider");
  }
}

/** Návrh / nabídka / podepsaná smlouva = finální vstup pro extrakci; modelace / ilustrace = nefinální. */
export function normalizeFinalityContentFlags(envelope: DocumentReviewEnvelope): void {
  const lc = envelope.documentClassification?.lifecycleStatus ?? "";
  const prev = envelope.contentFlags ?? {
    isFinalContract: false,
    isProposalOnly: false,
    containsPaymentInstructions: false,
    containsClientData: false,
    containsAdvisorData: false,
    containsMultipleDocumentSections: false,
  };

  if (isLifecycleNonFinalProjection(lc)) {
    envelope.contentFlags = { ...prev, isFinalContract: false, isProposalOnly: true };
  } else if (isLifecycleFinalInput(lc)) {
    envelope.contentFlags = { ...prev, isFinalContract: true, isProposalOnly: false };
  }
}

const INVESTMENT_PRIMARIES: PrimaryDocumentType[] = [
  "investment_subscription_document",
  "investment_service_agreement",
  "investment_modelation",
];

/** Stejná osoba nesmí být investor i zprostředkovatel — ponech investor, intermediary zruš. */
export function resolveInvestorIntermediaryDuplicateForInvestment(
  primary: PrimaryDocumentType,
  ef: Record<string, ExtractedField | undefined>
): void {
  if (!INVESTMENT_PRIMARIES.includes(primary)) return;
  if (!isPresent(ef.investorFullName) || !isPresent(ef.intermediaryName)) return;
  if (!strEq(ef.investorFullName?.value, ef.intermediaryName?.value)) return;
  ef.intermediaryName = {
    value: null,
    status: "not_applicable",
    confidence: 1,
    evidenceSnippet: "[semantic] Stejná hodnota jako investor — zprostředkovatel vypnut.",
  };
}

/** insurer / institutionName / provider se stejnou hodnotou → jedna kanonická vazba, bez tripletu. */
export function dedupeInstitutionIdentityFields(ef: Record<string, ExtractedField | undefined>): void {
  const ins = ef.insurer;
  const inst = ef.institutionName;
  const prov = ef.provider;
  if (!isPresent(ins) || !isPresent(inst)) return;
  if (!strEq(ins?.value, inst?.value)) return;
  if (isPresent(prov) && strEq(prov?.value, ins?.value)) {
    ef.provider = {
      value: null,
      status: "not_applicable",
      confidence: 1,
      evidenceSnippet: "[semantic] Duplicitní vůči pojistiteli/instituci.",
    };
  }
}

const NONLIFE_PRIMARIES: PrimaryDocumentType[] = [
  "nonlife_insurance_contract",
  "liability_insurance_offer",
];

/** Prázdné investiční struktury u čistě neživotního vozidla/majetku = šum z modelu, ne „fake“ investice. */
export function clearNonLifeEmptyInvestmentNoise(
  primary: PrimaryDocumentType,
  ef: Record<string, ExtractedField | undefined>
): void {
  if (!NONLIFE_PRIMARIES.includes(primary)) return;
  if (!hasVehicleSubjectSignals(ef)) return;

  for (const key of ["investmentFunds", "investmentStrategy", "intendedInvestment"] as const) {
    const c = ef[key];
    if (!c || !isPresent(c)) continue;
    const raw = String(c.value ?? "").trim();
    if (raw === "" || raw === "[]" || raw === "{}" || raw === "null") {
      ef[key] = {
        value: null,
        status: "not_applicable",
        confidence: 1,
        evidenceSnippet: "[semantic] Neživotní předmět — prázdné investiční pole potlačeno.",
      };
    }
  }
}

function payFreqIsAnnual(ef: Record<string, ExtractedField | undefined>): boolean {
  const v = String(ef.paymentFrequency?.value ?? "").toLowerCase();
  return (
    v.includes("ročn") ||
    v.includes("rocn") ||
    v === "annual" ||
    v === "annually" ||
    v === "yearly"
  );
}

/** Roční frekvence + stejná částka v měsíčním i ročním poli → odstranit duplicitu v měsíčním. */
export function reconcileAnnualVsMonthlyPremiumFields(
  ef: Record<string, ExtractedField | undefined>
): void {
  if (!payFreqIsAnnual(ef)) return;
  const ann = ef.annualPremium;
  if (!isPresent(ann)) return;

  const monthly = ef.totalMonthlyPremium;
  if (
    isPresent(monthly) &&
    (strEq(ann?.value, monthly?.value) || approxEqualMoney(ann?.value, monthly?.value))
  ) {
    ef.totalMonthlyPremium = {
      value: null,
      status: "not_applicable",
      confidence: 1,
      evidenceSnippet: "[semantic] Roční frekvence — stejná částka odstraněna z měsíčního pole.",
    };
  }

  const mp = ef.monthlyPremium;
  if (isPresent(mp) && (strEq(ann?.value, mp?.value) || approxEqualMoney(ann?.value, mp?.value))) {
    ef.monthlyPremium = {
      value: null,
      status: "not_applicable",
      confidence: 1,
      evidenceSnippet: "[semantic] Roční frekvence — duplicita vůči ročnímu pojistnému odstraněna.",
    };
  }
}

const NONLIFE_PRIMARIES_FOR_RISK: PrimaryDocumentType[] = [
  "nonlife_insurance_contract",
  "liability_insurance_offer",
  "payment_instruction",
];

/**
 * Neživotní / platební instrukce: riskPremium nesmí nést dílčí krytí ani duplicitu vůči hlavní platbě.
 */
export function suppressNonlifeRiskPremiumWithoutStrongEvidence(
  primary: PrimaryDocumentType,
  ef: Record<string, ExtractedField | undefined>
): void {
  if (!NONLIFE_PRIMARIES_FOR_RISK.includes(primary)) return;
  const rpMaybe = ef.riskPremium;
  if (!isPresent(rpMaybe)) return;
  /** Zúžení pro TS: `Record<>` + indexovaný přístup ne vždy projde type guardem. */
  const rp: ExtractedField = rpMaybe;

  if (isPresent(ef.annualPremium) && approxEqualMoney(rp.value, ef.annualPremium.value)) {
    ef.riskPremium = {
      value: null,
      status: "not_applicable",
      confidence: 1,
      evidenceSnippet: "[semantic] Duplicita vůči ročnímu pojistnému — pole rizikové složky vypnuto.",
    };
    return;
  }
  if (isPresent(ef.totalMonthlyPremium) && approxEqualMoney(rp.value, ef.totalMonthlyPremium.value)) {
    ef.riskPremium = {
      value: null,
      status: "not_applicable",
      confidence: 1,
      evidenceSnippet: "[semantic] Duplicita vůči hlavní platbě — pole rizikové složky vypnuto.",
    };
    return;
  }

  if (!nonlifeRiskPremiumHasExplicitSemantics(rp)) {
    ef.riskPremium = {
      value: null,
      status: "not_applicable",
      confidence: 1,
      evidenceSnippet:
        "[semantic] Neživotní dokument — rizikové pojistné jen při výslovné označení rizikové složky v textu nebo tabulce.",
    };
  }
}

/**
 * Single entry: mutates envelope.extractedFields and contentFlags in place.
 */
const LOAN_PRIMARY_TYPES: PrimaryDocumentType[] = [
  "consumer_loan_contract",
  "consumer_loan_with_payment_protection",
  "mortgage_document",
];

/** Úvěrová pole v neúvěrovém segmentu = šum z modelu / křížové mapování — vyčistit. */
const CROSS_SEGMENT_LOAN_FIELD_KEYS = [
  "loanAmount",
  "loanPrincipal",
  "principalAmount",
  "creditAmount",
  "installmentAmount",
  "monthlyInstallment",
  "installmentCount",
  "interestRate",
  "rpsn",
  "loanEndDate",
  "loanMaturity",
  "accountForRepayment",
  "lender",
] as const;

/**
 * Odstraní úvěrová pole u životního / investičního dokumentu (žádný vendor regex — jen segment).
 */
export function suppressCrossSegmentLoanFields(
  primary: PrimaryDocumentType,
  ef: Record<string, ExtractedField | undefined>,
): void {
  if (LOAN_PRIMARY_TYPES.includes(primary)) return;
  for (const key of CROSS_SEGMENT_LOAN_FIELD_KEYS) {
    const c = ef[key];
    if (!c || !isPresent(c)) continue;
    ef[key] = {
      value: null,
      status: "not_applicable",
      confidence: 1,
      evidenceSnippet: "[semantic] Úvěrové pole u neúvěrového typu dokumentu — potlačeno.",
    };
  }
}

/**
 * Obsahuje dokument platební sekci, ale bez cílových údajů vhodných pro synchronizaci → pouze informativní.
 */
export function reconcilePaymentInformationalSemantics(envelope: DocumentReviewEnvelope): void {
  const prev = envelope.contentFlags ?? {
    isFinalContract: false,
    isProposalOnly: false,
    containsPaymentInstructions: false,
    containsClientData: false,
    containsAdvisorData: false,
    containsMultipleDocumentSections: false,
  };
  if (!prev.containsPaymentInstructions) return;
  const syncReady = isPaymentSyncReady(buildCanonicalPaymentPayload(envelope));
  envelope.contentFlags = {
    ...prev,
    paymentInformationalOnly: syncReady ? false : true,
  };
}

/**
 * Finální životní / investiční smlouva nesmí být degradována na „jen platební instrukci“ / podklad,
 * pokud má kompletní smluvní obal (číslo, instituce/správce, datum) a finální lifecycle.
 * Obecné pravidlo — bez vendor regexů; neaplikuje se na AML-only ani na bundle needsSplit.
 */
export function reconcilePublishHintsForFinalNonLoanContract(envelope: DocumentReviewEnvelope): void {
  const dc = envelope.documentClassification;
  const ef = envelope.extractedFields as Record<string, ExtractedField | undefined>;
  if (!dc) return;
  const primary = dc.primaryType ?? "unsupported_or_unknown";
  const isLife =
    primary.startsWith("life_insurance") ||
    primary === "life_insurance_contract" ||
    primary === "life_insurance_final_contract";
  const isInvestmentFinalContract =
    primary === "investment_subscription_document" ||
    primary === "investment_service_agreement" ||
    primary === "life_insurance_investment_contract";
  if (!isLife && !isInvestmentFinalContract) return;
  if (dc.lifecycleStatus !== "final_contract") return;
  if (!hasFullContractShell(ef)) return;
  if (isInvestmentFinalContract && !isPresent(ef.investorFullName) && !isPresent(ef.fullName)) return;

  const ph = envelope.publishHints;
  if (!ph) return;
  if (ph.needsSplit) return;

  const reasons = ph.reasons ?? [];
  if (reasons.includes("aml_fatca_section_only_no_publishable_contract")) return;

  const blockedByPaymentOnly = reasons.includes("payment_instruction_only_no_contract");
  const looksSupporting =
    ph.sensitiveAttachmentOnly === true ||
    ph.contractPublishable === false ||
    ph.reviewOnly === true;
  if (!blockedByPaymentOnly && !looksSupporting) return;

  const recoveryReason = isLife
    ? "life_insurance_final_contract_recovered"
    : "investment_final_contract_recovered";
  const nextReasons = [
    ...reasons.filter((r) => r !== "payment_instruction_only_no_contract"),
    recoveryReason,
  ];
  envelope.publishHints = {
    contractPublishable: true,
    reviewOnly: false,
    needsSplit: ph.needsSplit,
    needsManualValidation: ph.needsManualValidation,
    sensitiveAttachmentOnly: false,
    reasons: nextReasons,
  };
}

/** @deprecated Use reconcilePublishHintsForFinalNonLoanContract — alias pro zpětnou kompatibilitu. */
export function reconcilePublishHintsForFinalLifeInsuranceContract(
  envelope: DocumentReviewEnvelope,
): void {
  reconcilePublishHintsForFinalNonLoanContract(envelope);
}

export function applySemanticContractUnderstanding(envelope: DocumentReviewEnvelope): void {
  const ef = envelope.extractedFields as Record<string, ExtractedField | undefined>;
  let primary = envelope.documentClassification?.primaryType ?? "unsupported_or_unknown";

  promoteLooseFundAllocationToInvestmentFunds(primary, ef);
  promoteLooseIsinToCanonical(primary, ef);
  alignDocumentClassificationWithExtractedEvidence(envelope);
  primary = envelope.documentClassification?.primaryType ?? "unsupported_or_unknown";
  normalizeFinalityContentFlags(envelope);
  applySavingsInvestmentSemantics(primary, ef);
  dedupeInstitutionIdentityFields(ef);
  resolveInvestorIntermediaryDuplicateForInvestment(primary, ef);
  clearNonLifeEmptyInvestmentNoise(primary, ef);
  reconcileAnnualVsMonthlyPremiumFields(ef);
  suppressNonlifeRiskPremiumWithoutStrongEvidence(primary, ef);
  suppressCrossSegmentLoanFields(primary, ef);
  reconcilePublishHintsForFinalNonLoanContract(envelope);
  reconcilePaymentInformationalSemantics(envelope);
}
