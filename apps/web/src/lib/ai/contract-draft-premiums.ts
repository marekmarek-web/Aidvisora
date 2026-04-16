/**
 * Derive CRM contract premium fields from AI extraction for apply-to-CRM drafts.
 */

import type { ExtractedContractSchema } from "./extraction-schemas";
import type { DocumentReviewEnvelope } from "./document-review-types";

export function parseMoneyInput(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  const s = String(v)
    .replace(/\s/g, "")
    .replace(/(\d)[,.](\d{3})\b/g, "$1$2")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function annualizeByFrequency(base: number, frequencyRaw: string): number {
  const f = frequencyRaw.toLowerCase();
  if (/year|roč|rocn|annual|yearly|ročne|rocne/.test(f)) return base;
  if (/quarter|čtvrt|ctvrt|kvart/.test(f)) return base * 4;
  if (/month|měsíč|mesic|monthly|měs|mes/.test(f)) return base * 12;
  if (/week|týden|tyden|weekly/.test(f)) return base * 52;
  if (/day|denně|denne|daily/.test(f)) return base * 365;
  // One-time / lump sum — no annualization
  if (/jednorázov|jednorazov|one.?time|lump.?sum|single.?prem/.test(f)) return base;
  // Default: treat as monthly instalment (common for ŽP / penze / invest)
  return base * 12;
}

/** Pick first positive monetary value from candidates. */
export function pickFirstAmount(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    const n = parseMoneyInput(c);
    if (n != null && n > 0) return n;
  }
  return null;
}

export function computeDraftPremiums(
  segment: string,
  extracted: ExtractedContractSchema
): { premiumAmount: string | null; premiumAnnual: string | null } {
  const freq = String(extracted.paymentDetails?.frequency ?? "");
  const base = pickFirstAmount(extracted.paymentDetails?.amount);
  if (base == null) return { premiumAmount: null, premiumAnnual: null };

  if (segment === "HYPO" || segment === "UVER") {
    const s = String(base);
    return { premiumAmount: s, premiumAnnual: s };
  }

  const annual = annualizeByFrequency(base, freq);
  const rounded = Math.round(annual * 100) / 100;
  return { premiumAmount: String(base), premiumAnnual: String(rounded) };
}

function fieldValue(envelope: DocumentReviewEnvelope, key: string): unknown {
  const direct = envelope.extractedFields[key];
  if (direct) return direct.value;
  const stripped = key.replace(/^extractedFields\./, "");
  return envelope.extractedFields[stripped]?.value;
}

/** Premium fields for draft payload from envelope (same sources as legacy projection + common aliases). */
export function computeDraftPremiumsFromEnvelope(
  envelope: DocumentReviewEnvelope,
  segment: string
): { premiumAmount: string | null; premiumAnnual: string | null } {
  const freq = String(
    fieldValue(envelope, "paymentFrequency") ??
      fieldValue(envelope, "frequency") ??
      ""
  );
  const base = pickFirstAmount(
    fieldValue(envelope, "regularAmount"),
    fieldValue(envelope, "premium"),
    fieldValue(envelope, "monthlyPremium"),
    fieldValue(envelope, "annualPremium"),
    fieldValue(envelope, "loanAmount"),
    fieldValue(envelope, "installmentAmount"),
    fieldValue(envelope, "amount")
  );
  if (base == null) return { premiumAmount: null, premiumAnnual: null };

  if (segment === "HYPO" || segment === "UVER") {
    const s = String(base);
    return { premiumAmount: s, premiumAnnual: s };
  }

  // One-time payment — no annualization, premiumAnnual stays null
  const isOneTime = /jednorázov|jednorazov|one.?time|lump.?sum|single.?prem/.test(freq.toLowerCase());
  if (isOneTime) {
    return { premiumAmount: String(base), premiumAnnual: null };
  }

  const rawAnnual = parseMoneyInput(fieldValue(envelope, "annualPremium"));
  if (rawAnnual != null && rawAnnual > 0) {
    return { premiumAmount: String(base), premiumAnnual: String(Math.round(rawAnnual * 100) / 100) };
  }

  const annual = annualizeByFrequency(base, freq);
  const rounded = Math.round(annual * 100) / 100;
  return { premiumAmount: String(base), premiumAnnual: String(rounded) };
}
