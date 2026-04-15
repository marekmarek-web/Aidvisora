/**
 * Phase 3 — canonical payment field contract.
 *
 * Single source of truth for which payment fields exist, which are required
 * for a client-ready payment setup, and how to extract them from an envelope.
 */

import type { DocumentReviewEnvelope, PrimaryDocumentType } from "./document-review-types";
import { normalizeDateToISO } from "./canonical-date-normalize";
import { resolvePaymentSemanticContext, selectCanonicalPaymentAmount } from "./payment-semantics";

/** Remove mistaken duplicate bank suffix, e.g. "2727/2700/2700" → "2727/2700". */
export function dedupeCzechAccountTrailingBankCode(raw: string): string {
  let cleaned = raw.replace(/\s/g, "").trim();
  let prev: string;
  do {
    prev = cleaned;
    const m = cleaned.match(/^(.+)\/(\d{4})\/\2$/);
    if (m) cleaned = `${m[1]}/${m[2]}`;
  } while (cleaned !== prev);
  return cleaned;
}

/**
 * Single canonical domestic account + bank code: no double "/bank/bank", and if the account
 * string already ends with /NNNN, the separate bankCode must not be appended again in UI.
 */
export function normalizeDomesticAccountAndBankCode(
  accountNumber: string,
  bankCode: string
): { accountNumber: string; bankCode: string } {
  let acc = dedupeCzechAccountTrailingBankCode(accountNumber.trim());
  const bc = bankCode.replace(/\s/g, "").trim();
  const embedded = acc.match(/^(.+)\/(\d{4})$/);
  if (embedded) {
    const code = embedded[2];
    if (!bc || bc === code) {
      return { accountNumber: acc, bankCode: code };
    }
    return { accountNumber: acc, bankCode: code };
  }
  if (acc && bc && !acc.includes("/")) {
    return { accountNumber: `${acc}/${bc}`, bankCode: bc };
  }
  return { accountNumber: acc, bankCode: bc };
}

/** 1–10 digits; spaces stripped. */
export function isValidPaymentVariableSymbol(vs: string): boolean {
  const cleaned = vs.replace(/\s/g, "");
  return /^\d{1,10}$/.test(cleaned);
}

/** Reject labels / placeholders that are not numeric VS (e.g. "Číslo smlouvy", "VS:"). */
export function sanitizeVariableSymbolForCanonical(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/číslo\s*smlouvy|č\.\s*smlouvy|variabil|placeholder|^vs\s*$/i.test(t)) return "";
  if (!isValidPaymentVariableSymbol(t)) return "";
  return t.replace(/\s/g, "");
}

/** One display line for advisor summary / preview (uses same merge as canonical payload). */
export function formatDomesticAccountDisplayLine(accountNumber: string, bankCode: string): string {
  const { accountNumber: acc, bankCode: bc } = normalizeDomesticAccountAndBankCode(accountNumber, bankCode);
  if (!acc) return "";
  if (bc && acc.endsWith(`/${bc}`)) return acc;
  if (bc && !acc.includes("/")) return `${acc}/${bc}`;
  return acc;
}

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

/** Účetní role pro cílový účet pro příjem plateb (CRM) — nezaměňovat s klientským účtem z výpisu. */
const CLIENT_SOURCE_KINDS_FOR_ACCOUNT = new Set([
  "client_block",
  "policyholder_block",
  "investor_block",
  "owner_block",
]);

function shouldPreferRecipientAccountForPayment(primary: PrimaryDocumentType): boolean {
  return (
    primary.startsWith("life_insurance") ||
    primary === "life_insurance_investment_contract" ||
    primary.startsWith("investment") ||
    primary === "pension_contract"
  );
}

/**
 * Pro život/investice/penze: preferuj účet příjemce (správce) před `bankAccount`, pokud je
 * bankAccount z klientského bloku (jinak by šlo o klientský účet, ne o příjem pro CRM).
 */
export function fvAccountNumberForPaymentSync(
  ef: Record<string, { value?: unknown; sourceKind?: string } | undefined>,
  primary: PrimaryDocumentType,
): string {
  const order = shouldPreferRecipientAccountForPayment(primary)
    ? [
        "recipientAccount",
        "collectionAccount",
        "institutionBankAccount",
        "institutionCollectionAccount",
        "bankAccount",
        "accountNumber",
      ]
    : ["bankAccount", "accountNumber", "recipientAccount"];

  for (const k of order) {
    const cell = ef[k];
    if (!cell || cell.value == null) continue;
    const s = String(cell.value).trim();
    if (!s || s === "—" || s === "Nenalezeno") continue;
    if (
      shouldPreferRecipientAccountForPayment(primary) &&
      k === "bankAccount" &&
      cell.sourceKind &&
      CLIENT_SOURCE_KINDS_FOR_ACCOUNT.has(cell.sourceKind)
    ) {
      continue;
    }
    return s;
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
  const ctx = resolvePaymentSemanticContext(envelope);
  const result: CanonicalPaymentPayload = {};
  for (const spec of PAYMENT_FIELD_SPECS) {
    if (spec.canonical === "amount") {
      const semanticAmount = selectCanonicalPaymentAmount(ef, ctx);
      result.amount = semanticAmount || fvFromEnvelope(ef, spec.envelopeKeys);
    } else if (spec.canonical === "accountNumber") {
      result.accountNumber = fvAccountNumberForPaymentSync(
        ef as Record<string, { value?: unknown; sourceKind?: string } | undefined>,
        ctx.primaryType,
      );
    } else {
      result[spec.canonical] = fvFromEnvelope(ef, spec.envelopeKeys);
    }
  }
  if (result.firstPaymentDate) {
    result.firstPaymentDate = normalizeDateToISO(result.firstPaymentDate) || result.firstPaymentDate;
  }
  if (!result.currency) result.currency = "CZK";

  if (!result.iban && (result.accountNumber || result.bankCode)) {
    const n = normalizeDomesticAccountAndBankCode(result.accountNumber, result.bankCode);
    result.accountNumber = n.accountNumber;
    result.bankCode = n.bankCode;
  }
  if (result.variableSymbol) {
    result.variableSymbol = sanitizeVariableSymbolForCanonical(result.variableSymbol);
  }

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
  const primaryType =
    (payload.documentClassification as { primaryType?: PrimaryDocumentType } | undefined)?.primaryType ??
    "unsupported_or_unknown";
  const result: CanonicalPaymentPayload = {};
  for (const spec of PAYMENT_FIELD_SPECS) {
    if (spec.canonical === "amount") {
      const semanticAmount = selectCanonicalPaymentAmount(ef as DocumentReviewEnvelope["extractedFields"], {
        primaryType,
      });
      if (semanticAmount) {
        result.amount = semanticAmount;
        continue;
      }
    }
    if (spec.canonical === "accountNumber") {
      result.accountNumber = fvAccountNumberForPaymentSync(
        ef as Record<string, { value?: unknown; sourceKind?: string } | undefined>,
        primaryType,
      );
      continue;
    }
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

  if (!result.iban && (result.accountNumber || result.bankCode)) {
    const n = normalizeDomesticAccountAndBankCode(result.accountNumber, result.bankCode);
    result.accountNumber = n.accountNumber;
    result.bankCode = n.bankCode;
  }
  if (result.variableSymbol) {
    result.variableSymbol = sanitizeVariableSymbolForCanonical(result.variableSymbol);
  }

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
