/**
 * Phase 3 — canonical payment field contract.
 *
 * Single source of truth for which payment fields exist, which are required
 * for a client-ready payment setup, and how to extract them from an envelope.
 */

import type { DocumentReviewEnvelope } from "./document-review-types";
import { normalizeDateToISO } from "./canonical-date-normalize";

export type PaymentFieldTier = "required_for_sync" | "optional_visible" | "note_only";

export interface PaymentFieldSpec {
  canonical: string;
  tier: PaymentFieldTier;
  envelopeKeys: string[];
  label: string;
}

export const PAYMENT_FIELD_SPECS: PaymentFieldSpec[] = [
  { canonical: "amount", tier: "required_for_sync", envelopeKeys: ["totalMonthlyPremium", "premiumAmount", "regularAmount", "amount", "monthlyPremium"], label: "Částka" },
  { canonical: "currency", tier: "required_for_sync", envelopeKeys: ["currency"], label: "Měna" },
  { canonical: "iban", tier: "required_for_sync", envelopeKeys: ["iban", "ibanMasked"], label: "IBAN" },
  { canonical: "accountNumber", tier: "required_for_sync", envelopeKeys: ["bankAccount", "accountNumber", "recipientAccount"], label: "Číslo účtu" },
  { canonical: "bankCode", tier: "required_for_sync", envelopeKeys: ["bankCode"], label: "Kód banky" },
  { canonical: "variableSymbol", tier: "required_for_sync", envelopeKeys: ["variableSymbol"], label: "Variabilní symbol" },
  { canonical: "paymentFrequency", tier: "optional_visible", envelopeKeys: ["paymentFrequency", "premiumFrequency"], label: "Frekvence platby" },
  { canonical: "contractReference", tier: "optional_visible", envelopeKeys: ["contractReference", "contractNumber"], label: "Č. smlouvy" },
  { canonical: "provider", tier: "optional_visible", envelopeKeys: ["insurer", "institutionName", "provider", "platform"], label: "Poskytovatel" },
  { canonical: "productName", tier: "optional_visible", envelopeKeys: ["productName"], label: "Název produktu" },
  { canonical: "beneficiaryName", tier: "optional_visible", envelopeKeys: ["beneficiaryName"], label: "Příjemce" },
  { canonical: "firstPaymentDate", tier: "optional_visible", envelopeKeys: ["firstPaymentDate", "firstInstallmentDate"], label: "Datum první platby" },
  { canonical: "specificSymbol", tier: "note_only", envelopeKeys: ["specificSymbol"], label: "Specifický symbol" },
  { canonical: "constantSymbol", tier: "note_only", envelopeKeys: ["constantSymbol"], label: "Konstantní symbol" },
  { canonical: "clientNote", tier: "note_only", envelopeKeys: ["paymentPurpose", "paymentNote"], label: "Poznámka" },
];

export type CanonicalPaymentPayload = Record<string, string>;

function fvFromEnvelope(ef: DocumentReviewEnvelope["extractedFields"], keys: string[]): string {
  for (const k of keys) {
    const cell = ef[k];
    if (cell?.value != null) {
      const s = String(cell.value).trim();
      if (s && s !== "—" && s !== "Nenalezeno") return s;
    }
  }
  return "";
}

/**
 * Build a canonical payment payload from a DocumentReviewEnvelope.
 * This is the ONE function that both draft-actions and apply-contract-review
 * should use to get payment fields from an envelope.
 */
export function buildCanonicalPaymentPayload(envelope: DocumentReviewEnvelope): CanonicalPaymentPayload {
  const ef = envelope.extractedFields;
  const result: CanonicalPaymentPayload = {};
  for (const spec of PAYMENT_FIELD_SPECS) {
    result[spec.canonical] = fvFromEnvelope(ef, spec.envelopeKeys);
  }
  if (result.firstPaymentDate) {
    result.firstPaymentDate = normalizeDateToISO(result.firstPaymentDate) || result.firstPaymentDate;
  }
  if (!result.currency) result.currency = "CZK";
  return result;
}

/**
 * Build payment payload from raw extracted payload (corrected or original).
 * Handles both envelope shape and flat shapes.
 */
export function buildCanonicalPaymentPayloadFromRaw(
  payload: Record<string, unknown>
): CanonicalPaymentPayload | null {
  const ef = payload.extractedFields as Record<string, { value?: unknown }> | undefined;
  if (!ef || typeof ef !== "object") return null;
  const result: CanonicalPaymentPayload = {};
  for (const spec of PAYMENT_FIELD_SPECS) {
    for (const k of spec.envelopeKeys) {
      const cell = ef[k];
      if (cell?.value != null) {
        const s = String(cell.value).trim();
        if (s && s !== "—") {
          result[spec.canonical] = s;
          break;
        }
      }
    }
    if (!result[spec.canonical]) result[spec.canonical] = "";
  }
  if (result.firstPaymentDate) {
    result.firstPaymentDate = normalizeDateToISO(result.firstPaymentDate) || result.firstPaymentDate;
  }
  if (!result.currency) result.currency = "CZK";
  return result;
}

export function hasPaymentTarget(p: CanonicalPaymentPayload): boolean {
  return !!(p.iban || (p.accountNumber && p.bankCode));
}

export function isPaymentSyncReady(p: CanonicalPaymentPayload): boolean {
  return !!p.amount && hasPaymentTarget(p);
}

/** Fields that are missing but required for sync. */
export function missingRequiredPaymentFields(p: CanonicalPaymentPayload): PaymentFieldSpec[] {
  return PAYMENT_FIELD_SPECS.filter(
    (spec) => spec.tier === "required_for_sync" && !p[spec.canonical]
  ).filter((spec) => {
    if (spec.canonical === "iban" && p.accountNumber && p.bankCode) return false;
    if (spec.canonical === "accountNumber" && p.iban) return false;
    if (spec.canonical === "bankCode" && p.iban) return false;
    return true;
  });
}
