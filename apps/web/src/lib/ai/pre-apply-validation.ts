/**
 * Pre-apply validation contract (F2 Slice C).
 *
 * A reusable, domain-aware guard that runs before any CRM apply action.
 * Rules are derived from F2 plan §6. This module is intentionally decoupled from
 * any specific apply orchestrator so it can be reused by F3 wire-up, tests, and
 * future validation surfaces without change.
 *
 * Generic by design: no vendor names, no filenames, no anchor-specific hacks.
 */

import type { DocumentReviewEnvelope, DocumentLifecycleStatus } from "./document-review-types";
import {
  CONTRACT_SEGMENT_CODES,
  type ContractSegmentCode,
} from "../contracts/contract-segment-wizard-config";

// ─── Result types ─────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  /** Machine-readable rule identifier. */
  rule: string;
  /** Human-readable Czech message for advisor/UI surfaces. */
  message: string;
  severity: ValidationSeverity;
  /** The extractedField key or entity field that triggered the issue. */
  field?: string;
}

export interface ValidationResult {
  /** True only when there are no `error`-severity issues. */
  valid: boolean;
  issues: ValidationIssue[];
}

// ─── Lifecycle helpers ────────────────────────────────────────────────────────

/** Lifecycles that require a contractNumber to be present. */
const LIFECYCLE_REQUIRES_CONTRACT_NUMBER = new Set<DocumentLifecycleStatus>([
  "final_contract",
  "proposal",
  "offer",
  "confirmation",
  "policy_change_request",
  "annex",
]);

/** Lifecycles that are supporting/informational; looser rules apply. */
const SUPPORTING_LIFECYCLES = new Set<DocumentLifecycleStatus>([
  "statement",
  "payroll_statement",
  "income_proof",
  "tax_return",
  "tax_or_income_proof",
  "unknown",
]);

// ─── Internal helpers ─────────────────────────────────────────────────────────

function fieldValue(
  ef: Record<string, { value?: unknown; status?: string } | undefined> | undefined,
  ...keys: string[]
): string {
  if (!ef) return "";
  for (const key of keys) {
    const cell = ef[key];
    if (!cell) continue;
    if (
      cell.status === "missing" ||
      cell.status === "not_found" ||
      cell.status === "not_applicable" ||
      cell.status === "explicitly_not_selected"
    ) continue;
    const v = String(cell.value ?? "").trim();
    if (v && v !== "—" && v !== "null") return v;
  }
  return "";
}

function positiveNumber(raw: string): boolean {
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0;
}

// ─── Core validation function ─────────────────────────────────────────────────

/**
 * Validates a DocumentReviewEnvelope before it is applied to CRM.
 *
 * @param envelope - The review envelope produced by extraction pipeline.
 * @param segment  - The contract segment code (e.g. "ZP", "DPS"). Pass empty
 *                   string when segment is not yet known; rule 4 will flag it.
 * @returns ValidationResult with `valid = true` only when no errors exist.
 */
export function validateBeforeApply(
  envelope: DocumentReviewEnvelope,
  segment: string
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const ef = envelope.extractedFields as Record<string, { value?: unknown; status?: string } | undefined> | undefined;
  const lifecycle = envelope.documentClassification?.lifecycleStatus;
  const isSupporting = lifecycle ? SUPPORTING_LIFECYCLES.has(lifecycle) : false;

  // ── Rule 1: contractNumber required for binding lifecycles ─────────────────
  if (!isSupporting && lifecycle && LIFECYCLE_REQUIRES_CONTRACT_NUMBER.has(lifecycle)) {
    const contractNumber = fieldValue(
      ef,
      "contractNumber", "proposalNumber", "proposalNumber_or_contractNumber",
      "contractNumber_or_proposalNumber", "existingPolicyNumber",
      "accountOrReference", "referenceNumber", "businessCaseNumber",
      "loanContractNumber", "policyNumber",
    );
    if (!contractNumber) {
      issues.push({
        rule: "contract_number_required",
        field: "contractNumber",
        severity: "error",
        message: "Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.",
      });
    }
  }

  // ── Rule 2: policyholderName or domain equivalent must be present ──────────
  if (!isSupporting) {
    const holder = fieldValue(
      ef,
      "policyholderName",
      "policyholder",
      "fullName",
      "clientFullName",
      "investorFullName",
      "investorName",
      "borrowerName",
      "participantFullName",
      "participantName",
      "clientName",
      "applicantName",
      "customerName",
      "customer",
    );
    if (!holder) {
      issues.push({
        rule: "policyholder_name_required",
        field: "policyholderName",
        severity: "error",
        message: "Jméno pojistníka / klienta / účastníka musí být vyplněno.",
      });
    }
  }

  // ── Rule 3: partnerName must be present ────────────────────────────────────
  if (!isSupporting) {
    const partner = fieldValue(
      ef,
      "partnerName",
      "insurer",
      "bankName",
      "lender",
      "institutionName",
      "provider",
      "pensionFundName",
      "companyName",
      "platform",
      "fundManager",
      "assetManager",
    );
    if (!partner) {
      issues.push({
        rule: "partner_name_required",
        field: "partnerName",
        severity: "error",
        message: "Název partnera (pojišťovna, banka, fond) musí být vyplněn.",
      });
    }
  }

  // ── Rule 4: segment must be a valid contractSegments code ──────────────────
  if (!segment || !(CONTRACT_SEGMENT_CODES as readonly string[]).includes(segment)) {
    issues.push({
      rule: "segment_invalid",
      field: "segment",
      severity: "error",
      message: `Segment „${segment || "(prázdný)"}" není platnou hodnotou. Povolené segmenty: ${CONTRACT_SEGMENT_CODES.join(", ")}.`,
    });
  }

  // ── Rule 5: premiumAmount must be positive when present ───────────────────
  const rawPremium = fieldValue(ef, "premiumAmount", "regularAmount", "totalMonthlyPremium", "annualPremium");
  if (rawPremium && !positiveNumber(rawPremium)) {
    issues.push({
      rule: "premium_amount_positive",
      field: "premiumAmount",
      severity: "error",
      message: `Výše pojistného / příspěvku musí být kladné číslo (nalezeno: „${rawPremium}").`,
    });
  }

  // ── Rule 6: will_sync payment must have account or IBAN ───────────────────
  // Detect will_sync from payment-field status; apply callers may annotate this.
  // We check the canonical payment fields on the envelope as a proxy.
  const paymentSyncCandidate = fieldValue(ef, "accountNumber", "iban");
  const hasPaymentDetails = !!paymentSyncCandidate;
  // Only enforce when the document has payment-instruction-like lifecycle and payment fields exist partially.
  const hasPartialPayment =
    fieldValue(ef, "variableSymbol", "bankCode", "bic") &&
    !hasPaymentDetails;
  if (hasPartialPayment) {
    issues.push({
      rule: "payment_sync_needs_account",
      field: "accountNumber",
      severity: "warning",
      message: "Platební instrukce obsahují symbol nebo kód banky, ale chybí číslo účtu nebo IBAN. Synchronizace platby nebude možná.",
    });
  }

  // ── Rule 7: DPS requires participantContribution ───────────────────────────
  const seg = segment as ContractSegmentCode;
  if (seg === "DPS" && !isSupporting) {
    const contrib = fieldValue(ef, "participantContribution", "contributionParticipant", "mesicniPrispevek", "monthlyContribution");
    if (!contrib) {
      issues.push({
        rule: "dps_participant_contribution_required",
        field: "participantContribution",
        severity: "warning",
        message: "Pro segment DPS je očekáván příspěvek účastníka (participantContribution). Pole není vyplněno.",
      });
    }
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
  };
}

// ─── Lifecycle guard shortcut ─────────────────────────────────────────────────

/**
 * Returns true when the envelope's lifecycle suggests it is a binding/final document
 * that must pass strict pre-apply validation before CRM write.
 */
export function isBindingLifecycle(lifecycle: DocumentLifecycleStatus | undefined | null): boolean {
  if (!lifecycle) return false;
  return LIFECYCLE_REQUIRES_CONTRACT_NUMBER.has(lifecycle);
}

/**
 * Returns true when the lifecycle is supporting / informational only.
 * Supporting docs skip most strict rules.
 */
export function isSupportingLifecycle(lifecycle: DocumentLifecycleStatus | undefined | null): boolean {
  if (!lifecycle) return true;
  return SUPPORTING_LIFECYCLES.has(lifecycle);
}
