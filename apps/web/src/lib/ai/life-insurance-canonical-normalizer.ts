/**
 * Phase 3 — Life Insurance Canonical Normalizer
 *
 * Takes the extracted DocumentReviewEnvelope (flat extractedFields + parties)
 * and produces the structured canonical Phase 3 arrays:
 *   participants[], insuredRisks[], healthQuestionnaires[],
 *   investmentData, paymentData, publishHints
 *
 * Design rules:
 * - Only reads from the envelope — never writes to extractedFields.
 * - Additive: existing flat fields remain untouched.
 * - Runs after main extraction; result is merged back into the envelope.
 * - Handles the "flat life insurance" case (single person, flat fields) as well as
 *   the "multi-person" case where parties or insuredPersons arrays are present.
 */

import type { DocumentReviewEnvelope } from "./document-review-types";
import type {
  ParticipantRecord,
  InsuredRiskRecord,
  HealthQuestionnaireRecord,
  InvestmentDataRecord,
  PaymentDataRecord,
  PublishHints,
  ParticipantRole,
  PacketMeta,
} from "./document-packet-types";
import { derivePublishHintsFromPacket } from "./document-packet-segmentation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function hasAnyKey(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => obj[key] != null);
}

function compactText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    const s = String(v).trim();
    return s.length > 0 ? s : null;
  }
  if (isPlainObject(v)) {
    for (const key of ["value", "amount", "insuredAmount", "sumInsured", "benefit", "label", "name", "text", "parameter", "frequency", "notes"]) {
      const nested = compactText(v[key]);
      if (nested) return nested;
    }
  }
  return null;
}

function arrayFromUnknown(raw: unknown, itemKeys: string[] = []): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw.flatMap((item) => arrayFromUnknown(item, itemKeys));
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return arrayFromUnknown(parsed, itemKeys);
    } catch {
      return [];
    }
  }
  if (isPlainObject(raw)) {
    if (hasAnyKey(raw, itemKeys)) return [raw];
    const nested =
      raw.items ??
      raw.rows ??
      raw.risks ??
      raw.coverages ??
      raw.coverageLines ??
      raw.benefits ??
      raw.riders ??
      raw.selectedRisks ??
      raw.insuranceRisks ??
      raw.insuredRisks ??
      raw.insuredPersons ??
      raw.insuredPeople ??
      raw.participants ??
      raw.persons ??
      raw.people;
    const fromNested = arrayFromUnknown(nested, itemKeys);
    if (fromNested.length > 0) return fromNested;
    return Object.values(raw).flatMap((item) => arrayFromUnknown(item, itemKeys));
  }
  return [];
}

function fieldVal(ef: DocumentReviewEnvelope["extractedFields"], key: string): string | null {
  const f = ef[key];
  if (!f) return null;
  if (f.status === "missing" || f.status === "not_found" || f.status === "not_applicable") return null;
  const v = f.value;
  if (v == null) return null;
  return compactText(v);
}

function fieldValNum(ef: DocumentReviewEnvelope["extractedFields"], key: string): number | string | null {
  const f = ef[key];
  if (!f) return null;
  if (f.status === "missing" || f.status === "not_found") return null;
  const v = f.value;
  if (v == null) return null;
  if (typeof v === "number") return v;
  return compactText(v);
}

function fieldConf(ef: DocumentReviewEnvelope["extractedFields"], key: string): number {
  return typeof ef[key]?.confidence === "number" ? (ef[key]!.confidence as number) : 0.5;
}

function pageOf(ef: DocumentReviewEnvelope["extractedFields"], key: string): number | null {
  const p = ef[key]?.sourcePage;
  return typeof p === "number" ? p : null;
}

function roleFromString(raw: string): ParticipantRole {
  const r = raw.toLowerCase();
  if (r.includes("second_insured") || r.includes("2.") || r.includes("druh")) return "second_insured";
  if (r.includes("pojistník") || r.includes("policyholder")) return "policyholder";
  if (r.includes("pojištěn") || r.includes("insured")) return "insured";
  if (r.includes("zákonný") || r.includes("legal_representative") || r.includes("representative")) return "legal_representative";
  if (r.includes("oprávněn") || r.includes("beneficiar")) return "beneficiary";
  if (r.includes("dítě") || r.includes("child") || r.includes("child_insured")) return "child_insured";
  if (r.includes("spoludlužník") || r.includes("co_applicant") || r.includes("co-applicant")) return "co_applicant";
  if (r.includes("dlužník") || r.includes("borrower")) return "borrower";
  if (r.includes("ručitel") || r.includes("guarantor")) return "guarantor";
  if (
    r.includes("investor") ||
    r.includes("upisovatel") ||
    r.includes("účastník") ||
    r.includes("ucastnik") ||
    r.includes("participant")
  ) {
    return "investor";
  }
  return "other";
}

/**
 * Canonical primary role depends on the document family: investment docs use
 * "investor", pension / DPS docs use "participant", loan docs use "borrower".
 * Returns "policyholder" as a safe fallback for insurance documents and
 * anything not explicitly mapped.
 */
function defaultPrimaryRoleForDocType(
  primary: DocumentReviewEnvelope["documentClassification"]["primaryType"],
): ParticipantRole {
  switch (primary) {
    case "investment_subscription_document":
    case "investment_service_agreement":
    case "investment_modelation":
    case "investment_payment_instruction":
      return "investor";
    case "pension_contract":
      return "investor";
    case "mortgage_document":
    case "consumer_loan_contract":
    case "consumer_loan_with_payment_protection":
      return "borrower";
    default:
      return "policyholder";
  }
}

// ─── Participant extraction ───────────────────────────────────────────────────

/**
 * Build participants[] from flat extractedFields.
 * Handles three cases:
 *  A) Simple single-person: fullName/birthDate/... in extractedFields
 *  B) Structured insuredPersons array in extractedFields.insuredPersons.value
 *  C) parties record (generic map from pipeline)
 */
function extractParticipants(env: DocumentReviewEnvelope): ParticipantRecord[] {
  const ef = env.extractedFields ?? {};
  const participants: ParticipantRecord[] = [];
  const personItemKeys = ["fullName", "name", "firstName", "lastName", "role", "typ", "birthDate", "dateOfBirth", "personalId"];

  for (const existing of env.participants ?? []) {
    if (existing?.fullName) participants.push(existing);
  }

  // Case B: structured person fields (AI may return JSON string, native array, object wrapper, or single object)
  for (const fieldKey of ["insuredPersons", "insuredPerson", "insuredPeople", "participants", "persons", "people", "mainInsured", "additionalInsured"]) {
    const raw = ef[fieldKey]?.value;
    for (const p of arrayFromUnknown(raw, personItemKeys)) {
    const role = roleFromString(String(p.role ?? p.typ ?? "insured"));
    const fullName =
      compactText(p.fullName) ??
      compactText(p.name) ??
      ([compactText(p.firstName), compactText(p.lastName)].filter(Boolean).join(" ").trim() || null);
    if (!fullName) continue;
    if (participants.some((existing) => existing.fullName?.toLowerCase() === fullName.toLowerCase())) continue;
    participants.push({
      role,
      fullName,
      birthDate: compactText(p.birthDate) ?? compactText(p.dateOfBirth),
      maskedPersonalId: compactText(p.personalId) ?? compactText(p.maskedPersonalId),
      address: compactText(p.address),
      email: compactText(p.email),
      phone: compactText(p.phone),
      occupation: compactText(p.occupation),
      confidence: 0.75,
    });
    }
  }

  // Case C: parties record
  const parties = env.parties ?? {};
  for (const [key, rawValue] of Object.entries(parties)) {
    if (rawValue == null || typeof rawValue !== "object" || Array.isArray(rawValue)) continue;
    const p = rawValue as Record<string, unknown>;
    const roleName = String(p.role ?? p.type ?? key ?? "");
    const role = roleFromString(roleName);
    // Skip advisor-type entries
    if (
      roleName.toLowerCase().includes("advisor") ||
      roleName.toLowerCase().includes("broker") ||
      roleName.toLowerCase().includes("intermediar") ||
      roleName.toLowerCase().includes("zprostředkov")
    ) continue;

    const fullName =
      (p.fullName != null ? String(p.fullName) : null) ??
      ([p.firstName, p.lastName].filter(Boolean).join(" ") || null);
    if (!fullName && p.name == null) continue;

    // Avoid duplicates from insuredPersons parse above
    const alreadyIn = participants.some(
      (existing) =>
        existing.fullName != null &&
        fullName != null &&
        existing.fullName.toLowerCase() === fullName.toLowerCase()
    );
    if (alreadyIn) continue;

    participants.push({
      role,
      fullName: fullName ?? (p.name != null ? String(p.name) : null),
      birthDate: p.birthDate != null ? String(p.birthDate) : null,
      maskedPersonalId: p.personalId != null ? String(p.personalId) : null,
      address: p.address != null ? String(p.address) : null,
      email: p.email != null ? String(p.email) : null,
      phone: p.phone != null ? String(p.phone) : null,
      occupation: p.occupation != null ? String(p.occupation) : null,
      confidence: 0.65,
    });
  }

  // Case A: flat primary client fields — add with role derived from the document
  // family (investor / participant / borrower / policyholder) if no primary client
  // participant exists yet. investorFullName is used by DIP/investment subscription schemas.
  const primaryName =
    fieldVal(ef, "fullName") ??
    fieldVal(ef, "clientFullName") ??
    fieldVal(ef, "investorFullName") ??
    fieldVal(ef, "participantFullName") ??
    fieldVal(ef, "borrowerName") ??
    fieldVal(ef, "policyholderName") ??
    fieldVal(ef, "proposerName");
  const primaryRole = defaultPrimaryRoleForDocType(env.documentClassification.primaryType);
  const hasPrimaryClient = participants.some(
    (p) =>
      p.role === "policyholder" ||
      p.role === "insured" ||
      p.role === "investor" ||
      p.role === "borrower",
  );
  if (primaryName && !hasPrimaryClient) {
    participants.unshift({
      role: primaryRole,
      fullName: primaryName,
      birthDate: fieldVal(ef, "birthDate"),
      maskedPersonalId: fieldVal(ef, "maskedPersonalId") ?? fieldVal(ef, "personalId"),
      address: fieldVal(ef, "address") ?? fieldVal(ef, "permanentAddress"),
      email: fieldVal(ef, "email") ?? fieldVal(ef, "clientEmail"),
      phone: fieldVal(ef, "phone") ?? fieldVal(ef, "clientPhone"),
      occupation: fieldVal(ef, "occupation"),
      sourcePage: pageOf(ef, "fullName") ?? pageOf(ef, "clientFullName"),
      confidence: fieldConf(ef, "fullName"),
    });
  }

  // Add insured person from insuredPersonName if distinct from policyholder
  const insuredName = fieldVal(ef, "insuredPersonName") ?? fieldVal(ef, "insuredPerson");
  if (insuredName && !participants.some((p) => p.fullName?.toLowerCase() === insuredName.toLowerCase())) {
    participants.push({
      role: "insured",
      fullName: insuredName,
      birthDate: fieldVal(ef, "insuredBirthDate"),
      confidence: 0.7,
    });
  }

  const secondInsuredName = fieldVal(ef, "secondInsuredName") ?? fieldVal(ef, "insuredPerson2");
  if (secondInsuredName && !participants.some((p) => p.fullName?.toLowerCase() === secondInsuredName.toLowerCase())) {
    participants.push({
      role: "second_insured",
      fullName: secondInsuredName,
      birthDate: fieldVal(ef, "secondInsuredBirthDate"),
      maskedPersonalId: fieldVal(ef, "secondInsuredPersonalId"),
      confidence: 0.7,
    });
  }

  // Add beneficiary if present and not already in list
  const benefRaw = ef["beneficiaries"]?.value;
  if (benefRaw != null && typeof benefRaw === "string" && benefRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(benefRaw) as unknown;
      if (Array.isArray(parsed)) {
        for (const b of parsed) {
          const bObj = b as Record<string, unknown>;
          const name = bObj.fullName != null ? String(bObj.fullName) : (bObj.name != null ? String(bObj.name) : null);
          if (name && !participants.some((p) => p.fullName?.toLowerCase() === name.toLowerCase())) {
            participants.push({
              role: "beneficiary",
              fullName: name,
              confidence: 0.65,
            });
          }
        }
      }
    } catch {
      // plain text beneficiary — don't try to parse further
    }
  }

  return participants;
}

// ─── Insured risks extraction ─────────────────────────────────────────────────

function extractInsuredRisks(env: DocumentReviewEnvelope, participants: ParticipantRecord[]): InsuredRiskRecord[] {
  const ef = env.extractedFields ?? {};
  const risks: InsuredRiskRecord[] = [];
  const riskItemKeys = ["riskType", "type", "code", "riskLabel", "label", "name", "insuredAmount", "sumInsured", "benefitAmount", "limit", "monthlyBenefit", "premium"];

  // Try structured coverages / riders / insuredRisks fields
  for (const fieldKey of ["insuredRisks", "coverages", "coverageLines", "benefits", "riders", "selectedRisks", "insuranceRisks"]) {
    const raw = ef[fieldKey]?.value;
    if (raw == null) continue;

    for (const r of arrayFromUnknown(raw, riskItemKeys)) {
      const linkedName =
        compactText(r.person) ??
        compactText(r.insuredPerson) ??
        compactText(r.linkedParticipant) ??
        compactText(r.linkedParticipantName) ??
        participants.find((p) => p.role === "insured" || p.role === "policyholder")?.fullName ??
        null;
      risks.push({
        linkedParticipantName: linkedName,
        linkedParticipantRole: participants.find(
          (p) => p.fullName != null && p.fullName === linkedName
        )?.role ?? null,
        riskType: compactText(r.type) ?? compactText(r.riskType) ?? compactText(r.code) ?? "unknown",
        riskLabel: compactText(r.label) ?? compactText(r.name) ?? compactText(r.riskLabel) ?? compactText(r.type) ?? "Riziko",
        insuredAmount:
          compactText(r.amount) ??
          compactText(r.insuredAmount) ??
          compactText(r.sumInsured) ??
          compactText(r.benefitAmount) ??
          compactText(r.limit) ??
          compactText(r.monthlyBenefit),
        termEnd: compactText(r.termEnd) ?? compactText(r.endDate) ?? compactText(r.duration),
        premium: compactText(r.premium) ?? compactText(r.riskPremium),
        parameter:
          compactText(r.parameter) ??
          compactText(r.frequency) ??
          compactText(r.benefitFrequency) ??
          compactText(r.waitingPeriod) ??
          compactText(r.deductible),
        notes: compactText(r.notes) ?? compactText(r.note) ?? compactText(r.conditions),
      });
    }
  }

  // Flat risk fields as fallback: deathBenefit, accidentBenefit, etc.
  const flatRisks: Array<{ key: string; label: string; type: string }> = [
    { key: "deathBenefit", label: "Pojistná částka pro případ smrti", type: "death" },
    { key: "accidentBenefit", label: "Úrazové pojištění", type: "accident" },
    { key: "disabilityBenefit", label: "Invalidita", type: "disability" },
    { key: "hospitalizationBenefit", label: "Hospitalizace", type: "hospitalization" },
    { key: "seriousIllnessBenefit", label: "Závažná onemocnění", type: "serious_illness" },
  ];

  const primaryParticipant =
    participants.find((p) => p.role === "insured") ??
    participants.find((p) => p.role === "policyholder") ??
    null;

  for (const { key, label, type } of flatRisks) {
    const val = fieldValNum(ef, key);
    if (val == null) continue;
    const alreadyCovered = risks.some((r) => r.riskType === type || r.riskLabel.toLowerCase().includes(label.toLowerCase().slice(0, 8)));
    if (!alreadyCovered) {
      risks.push({
        linkedParticipantName: primaryParticipant?.fullName ?? null,
        linkedParticipantRole: primaryParticipant?.role ?? null,
        riskType: type,
        riskLabel: label,
        insuredAmount: val,
        sourcePage: pageOf(ef, key),
      });
    }
  }

  return risks;
}

// ─── Health questionnaire detection ──────────────────────────────────────────

function extractHealthQuestionnaires(
  env: DocumentReviewEnvelope,
  packetMeta: PacketMeta | null | undefined,
  participants: ParticipantRecord[]
): HealthQuestionnaireRecord[] {
  const result: HealthQuestionnaireRecord[] = [];

  // Check packet meta first
  const packetHealthCandidates = (packetMeta?.subdocumentCandidates ?? []).filter(
    (c) => c.type === "health_questionnaire" && c.confidence >= 0.3
  );

  if (packetHealthCandidates.length > 0) {
    for (const candidate of packetHealthCandidates) {
      result.push({
        linkedParticipantName: participants.find((p) => p.role === "insured" || p.role === "policyholder")?.fullName ?? null,
        questionnairePresent: true,
        sectionSummary: candidate.sectionHeadingHint ?? candidate.label,
        medicallyRelevantFlags: [],
        publishableAsSeparateDocument: false,
      });
    }
    return result;
  }

  // Check sensitivity profile
  const profile = env.sensitivityProfile;
  const hasHealthSection =
    profile === "health_data" ||
    profile === "special_category_data" ||
    profile === "mixed_sensitive_document" ||
    env.sectionSensitivity?.["health_section"] === "health_data" ||
    env.sectionSensitivity?.["health_section"] === "special_category_data";

  if (hasHealthSection) {
    result.push({
      linkedParticipantName: participants.find((p) => p.role === "insured" || p.role === "policyholder")?.fullName ?? null,
      questionnairePresent: true,
      sectionSummary: "Zdravotní sekce detekována (sensitivity profile)",
      medicallyRelevantFlags: ["health_section_in_document"],
      publishableAsSeparateDocument: false,
    });
  }

  return result;
}

// ─── Investment data extraction ───────────────────────────────────────────────

function extractInvestmentData(env: DocumentReviewEnvelope): InvestmentDataRecord | null {
  const ef = env.extractedFields ?? {};
  const lifecycle = env.documentClassification?.lifecycleStatus;

  const strategy = fieldVal(ef, "investmentStrategy") ?? fieldVal(ef, "investmentAllocation");
  const investmentAmountRaw =
    fieldValNum(ef, "investmentPremium") ??
    fieldValNum(ef, "regularExtraContribution") ??
    fieldValNum(ef, "contributionAmount") ??
    fieldValNum(ef, "monthlyContribution");

  const fundsRaw = ef["investmentFunds"]?.value ?? ef["fundAllocation"]?.value;
  let funds: InvestmentDataRecord["funds"] = [];
  if (fundsRaw != null && typeof fundsRaw === "string") {
    try {
      const parsed = JSON.parse(fundsRaw) as unknown;
      if (Array.isArray(parsed)) {
        funds = parsed.map((f) => {
          const fObj = f as Record<string, unknown>;
          return {
            name: String(fObj.name ?? fObj.fund ?? fObj.fondName ?? "—"),
            allocation: fObj.allocation != null ? (fObj.allocation as string | number) : null,
          };
        });
      }
    } catch {
      // plain string — store as single entry
      if (fundsRaw.trim().length > 0) {
        funds = [{ name: fundsRaw.trim(), allocation: null }];
      }
    }
  }

  // For DIP/DPS investment accounts: productType signals the investment product even when
  // investment-specific fields (strategy, funds, amount) weren't extracted by the LLM.
  const productType = fieldVal(ef, "productType");
  const isDipDps = productType != null && /^(dip|dps|dlouhodoby.investicni|penzijni.sporeni)/i.test(productType);

  if (!strategy && funds.length === 0 && investmentAmountRaw == null && !isDipDps) return null;

  const isModeledData =
    lifecycle === "modelation" || lifecycle === "illustration" || lifecycle === "non_binding_projection";
  const isContractualData = lifecycle === "final_contract" || lifecycle === "confirmation";

  return {
    strategy: strategy ?? (isDipDps ? productType : null),
    funds,
    investmentAmount: investmentAmountRaw ?? null,
    isModeledData,
    isContractualData,
    notes: fieldVal(ef, "investmentScenario"),
  };
}

// ─── Payment data extraction ──────────────────────────────────────────────────

function extractPaymentData(env: DocumentReviewEnvelope): PaymentDataRecord | null {
  const ef = env.extractedFields ?? {};

  const accountNumber = fieldVal(ef, "bankAccount") ?? fieldVal(ef, "paymentAccountNumber") ?? fieldVal(ef, "accountNumber");
  const iban = fieldVal(ef, "iban");
  const bankCode = fieldVal(ef, "bankCode");
  const variableSymbol = fieldVal(ef, "variableSymbol");
  const paymentFrequency = fieldVal(ef, "paymentFrequency") ?? fieldVal(ef, "premiumFrequency");

  if (!accountNumber && !iban && !variableSymbol) return null;

  return {
    accountNumber,
    iban,
    bankCode,
    variableSymbol,
    paymentMethod: fieldVal(ef, "paymentMethod"),
    paymentFrequency,
    duePattern: fieldVal(ef, "firstPaymentDate") ?? fieldVal(ef, "paymentPurpose"),
    notes: null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CanonicalNormalizationResult {
  participants: ParticipantRecord[];
  insuredRisks: InsuredRiskRecord[];
  healthQuestionnaires: HealthQuestionnaireRecord[];
  investmentData: InvestmentDataRecord | null;
  paymentData: PaymentDataRecord | null;
  publishHints: PublishHints;
}

/**
 * Normalise a DocumentReviewEnvelope into the Phase 3 canonical structured fields.
 * Call after AI extraction completes. Always returns a complete result object.
 */
export function normalizeLifeInsuranceCanonical(
  env: DocumentReviewEnvelope,
  packetMeta?: PacketMeta | null
): CanonicalNormalizationResult {
  const participants = extractParticipants(env);
  const insuredRisks = extractInsuredRisks(env, participants);
  const healthQuestionnaires = extractHealthQuestionnaires(env, packetMeta, participants);
  const investmentData = extractInvestmentData(env);
  const paymentData = extractPaymentData(env);

  const publishHints = derivePublishHintsFromPacket(
    packetMeta,
    env.documentClassification?.lifecycleStatus,
    env.sensitivityProfile
  );

  return {
    participants,
    insuredRisks,
    healthQuestionnaires,
    investmentData,
    paymentData,
    publishHints,
  };
}

/**
 * Mutates the envelope in-place: attaches canonical normalisation results.
 * Safe to call on any DocumentReviewEnvelope; the LIFE insurance types get the richest output.
 * Other types get participants + paymentData + publishHints at minimum.
 */
export function applyCanonicalNormalizationToEnvelope(
  env: DocumentReviewEnvelope,
  packetMeta?: PacketMeta | null
): void {
  const primaryType = env.documentClassification?.primaryType;
  const isLifeInsurance =
    primaryType?.startsWith("life_insurance") === true ||
    primaryType === "pension_contract";

  const canonical = normalizeLifeInsuranceCanonical(env, packetMeta);

  env.participants = canonical.participants.length > 0 ? canonical.participants : null;
  env.publishHints = canonical.publishHints;
  env.paymentData = canonical.paymentData;

  if (isLifeInsurance || primaryType?.startsWith("investment") === true) {
    env.investmentData = canonical.investmentData;
  }

  if (isLifeInsurance) {
    env.insuredRisks = canonical.insuredRisks.length > 0 ? canonical.insuredRisks : null;
    env.healthQuestionnaires = canonical.healthQuestionnaires.length > 0 ? canonical.healthQuestionnaires : null;
  }

  if (packetMeta != null) {
    env.packetMeta = packetMeta;
  }
}
