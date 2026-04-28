import type { DocumentReviewEnvelope, ReviewWarning } from "./document-review-types";

export type UploadIntentForPublish = {
  isModelation?: boolean;
};

export type LearningValidatorResult = {
  envelope: DocumentReviewEnvelope;
  warnings: ReviewWarning[];
  autoFixesApplied: string[];
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function approxEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance;
}

function expectedInsuredCountFromText(documentText: string): number | null {
  const text = documentText.toLowerCase();
  const countLine = text.match(/počet\s+pojištěných\s*:[^\n\r]*/i)?.[0] ?? "";
  if (countLine) {
    const adults = Number.parseInt(countLine.match(/(\d+)\s*dospěl/i)?.[1] ?? "0", 10);
    const children = Number.parseInt(countLine.match(/(\d+)\s*d[ií]t[eě]/i)?.[1] ?? "0", 10);
    const total = adults + children;
    if (total > 0) return total;
  }
  const numbered = [...text.matchAll(/(\d+)\.\s*pojištěn/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite);
  if (numbered.length) return Math.max(...numbered);
  return null;
}

export function validateParticipantCount(envelope: DocumentReviewEnvelope, documentText: string): ReviewWarning[] {
  const expected = expectedInsuredCountFromText(documentText);
  if (!expected) return [];
  const actual = envelope.insuredPersons?.length || envelope.participants?.length || 0;
  if (actual >= expected) return [];
  return [{
    code: "participant_count_mismatch",
    message: `Dokument naznačuje ${expected} pojištěné osoby, ale extrakce obsahuje ${actual}. Ověřte seznam účastníků.`,
    field: "participants",
    severity: "critical",
  }];
}

export function validatePremiumAggregation(envelope: DocumentReviewEnvelope, documentText: string): LearningValidatorResult {
  const warnings: ReviewWarning[] = [];
  const autoFixesApplied: string[] = [];
  const insuredPremiums = (envelope.insuredPersons ?? [])
    .map((person) => toNumber(person.monthlyPremium))
    .filter((value): value is number => value != null);
  const hasNumberedPremiumRows =
    /celkov[eé]\s+b[eě][zž]n[eé]\s+m[eě]s[ií][cč]n[ií]\s+pojistn[eé]\s+pro\s+1\.\s+pojištěn/i.test(documentText) &&
    /celkov[eé]\s+b[eě][zž]n[eé]\s+m[eě]s[ií][cč]n[ií]\s+pojistn[eé]\s+pro\s+2\.\s+pojištěn/i.test(documentText);
  if (insuredPremiums.length < 2 && !hasNumberedPremiumRows) {
    return { envelope, warnings, autoFixesApplied };
  }

  const sum = insuredPremiums.reduce((acc, value) => acc + value, 0);
  const current = toNumber(envelope.premium?.totalMonthlyPremium);
  if (sum <= 0 || current == null || approxEqual(current, sum)) {
    return { envelope, warnings, autoFixesApplied };
  }

  if (insuredPremiums.length >= 2 && approxEqual(current, insuredPremiums[0])) {
    envelope.premium = {
      frequency: envelope.premium?.frequency ?? "monthly",
      totalAnnualPremium: envelope.premium?.totalAnnualPremium,
      validationWarnings: envelope.premium?.validationWarnings ?? [],
      calculationBreakdown: insuredPremiums.map((amount, index) => ({
        label: `${index + 1}. pojištěný`,
        amount,
        frequency: "monthly",
      })),
      totalMonthlyPremium: sum,
      source: "sum_of_insured_persons",
    };
    autoFixesApplied.push("premium.totalMonthlyPremium=sum_of_insured_persons");
    warnings.push({
      code: "premium_total_auto_fixed_from_insured_persons",
      message: "Celkové měsíční pojistné bylo dopočteno jako součet pojistného pojištěných osob.",
      field: "premium.totalMonthlyPremium",
      severity: "warning",
    });
    return { envelope, warnings, autoFixesApplied };
  }

  warnings.push({
    code: "premium_total_mismatch",
    message: "Celkové měsíční pojistné neodpovídá součtu pojistného pojištěných osob. Ověřte částky oproti dokumentu.",
    field: "premium.totalMonthlyPremium",
    severity: "critical",
  });
  return { envelope, warnings, autoFixesApplied };
}

export function validatePublishEligibility(params: {
  envelope: DocumentReviewEnvelope;
  uploadIntent?: UploadIntentForPublish | null;
  reviewApproved: boolean;
}): { shouldPublishToCrm: boolean; warnings: ReviewWarning[] } {
  const isModelation = params.uploadIntent?.isModelation === true || params.envelope.userDeclaredDocumentIntent?.isModelation === true;
  const shouldPublishToCrm = params.reviewApproved && !isModelation;
  return {
    shouldPublishToCrm,
    warnings: isModelation
      ? [{
          code: "publish_blocked_by_upload_intent_modelation",
          message: "Zápis do CRM je blokovaný pouze deklarovanou modelací při nahrání, ne samotnou AI klasifikací.",
          field: "publishHints.contractPublishable",
          severity: "warning",
        }]
      : [],
  };
}

export function validateCriticalFields(envelope: DocumentReviewEnvelope): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];
  const primaryType = envelope.documentClassification?.primaryType ?? "";
  const criticalContractLikeDocument =
    /contract|insurance|mortgage|loan|pension|investment|payment/i.test(primaryType) &&
    !/supporting|income|payslip|tax|identity|medical|consent/i.test(primaryType);
  if (!criticalContractLikeDocument) return warnings;
  const ef = envelope.extractedFields ?? {};
  if (!ef.contractNumber?.value) {
    warnings.push({ code: "critical_contract_number_missing", message: "Chybí číslo smlouvy.", field: "contractNumber", severity: "critical" });
  }
  if (!ef.institutionName?.value && !ef.insurer?.value) {
    warnings.push({ code: "critical_institution_missing", message: "Chybí instituce.", field: "institutionName", severity: "critical" });
  }
  return warnings;
}

export function validateCorrectionPatterns(
  envelope: DocumentReviewEnvelope,
  validatorHints: Record<string, unknown>[],
): ReviewWarning[] {
  const warnings: ReviewWarning[] = [];
  for (const hint of validatorHints) {
    if (hint.rule === "require_numbered_participants" && (envelope.insuredPersons?.length ?? 0) < 2) {
      warnings.push({
        code: "learning_pattern_participant_check",
        message: "Dřívější schválené opravy pro tento kontext často doplňovaly další pojištěné osoby. Ověřte je v aktuálním dokumentu.",
        field: "participants",
        severity: "warning",
      });
    }
  }
  return warnings;
}

export function runAiReviewLearningValidators(params: {
  envelope: DocumentReviewEnvelope;
  documentText: string;
  uploadIntent?: UploadIntentForPublish | null;
  reviewApproved?: boolean;
  validatorHints?: Record<string, unknown>[];
}): LearningValidatorResult & { shouldPublishToCrm: boolean } {
  const premium = validatePremiumAggregation(params.envelope, params.documentText);
  const publish = validatePublishEligibility({
    envelope: premium.envelope,
    uploadIntent: params.uploadIntent,
    reviewApproved: params.reviewApproved ?? false,
  });
  const warnings = [
    ...validateParticipantCount(premium.envelope, params.documentText),
    ...premium.warnings,
    ...validateCriticalFields(premium.envelope),
    ...validateCorrectionPatterns(premium.envelope, params.validatorHints ?? []),
    ...publish.warnings,
  ];
  return {
    envelope: premium.envelope,
    warnings,
    autoFixesApplied: premium.autoFixesApplied,
    shouldPublishToCrm: publish.shouldPublishToCrm,
  };
}
