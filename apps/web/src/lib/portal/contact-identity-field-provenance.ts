import type { AiProvenanceKind } from "@/lib/portal/ai-review-provenance";
import type { ContactAiProvenanceResult } from "@/app/actions/contacts";

export type ContactIdentityHeaderFields = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
};

/** Rozšíření pro záložku identity / CRM karty — všechna pole, kde řešíme stale pending. */
export type ContactIdentityDetailFields = ContactIdentityHeaderFields & {
  title?: string | null;
  personalId?: string | null;
  idCardNumber?: string | null;
};

function contactHasAddressLine(contact: ContactIdentityHeaderFields): boolean {
  return Boolean(
    (contact.street?.trim() ?? "") ||
      (contact.city?.trim() ?? "") ||
      (contact.zip?.trim() ?? ""),
  );
}

/**
 * Po aplikovaném AI Review může `policyEnforcementTrace` stále obsahovat `pendingConfirmationFields`,
 * i když jsou hodnoty už zapsané v CRM. V takovém případě neukazovat „Čeká na potvrzení“.
 */
export function resolveContactIdentityFieldProvenanceForContactRow(
  fieldKey: string,
  provenance: ContactAiProvenanceResult | null,
  contact: ContactIdentityDetailFields,
): { kind: AiProvenanceKind; reviewId: string; confirmedAt?: string | null } | null {
  const base = resolveContactIdentityFieldProvenance(fieldKey, provenance);
  if (!base || base.kind !== "pending_review") return base;

  switch (fieldKey) {
    case "firstName":
      if (contact.firstName?.trim()) return null;
      break;
    case "lastName":
      if (contact.lastName?.trim()) return null;
      break;
    case "email":
      if (contact.email?.trim()) return null;
      break;
    case "phone":
      if (contact.phone?.trim()) return null;
      break;
    case "birthDate":
      if (contact.birthDate?.trim()) return null;
      break;
    case "personalId":
      if (contact.personalId?.trim()) return null;
      break;
    case "idCardNumber":
      if (contact.idCardNumber?.trim()) return null;
      break;
    case "title":
      if (contact.title?.trim()) return null;
      break;
    case "address":
    case "street":
    case "city":
    case "zip":
      if (contactHasAddressLine(contact)) return null;
      break;
    default:
      break;
  }

  return base;
}

/**
 * Pro badge v hero: nezobrazovat „čeká na potvrzení“, pokud je pole na kontaktu už vyplněné
 * (stale položka v pendingFields z dřívějšího trace).
 */
export function resolveContactIdentityFieldProvenanceForHeader(
  fieldKey: string,
  provenance: ContactAiProvenanceResult | null,
  contact: ContactIdentityHeaderFields,
): { kind: AiProvenanceKind; reviewId: string; confirmedAt?: string | null } | null {
  return resolveContactIdentityFieldProvenanceForContactRow(fieldKey, provenance, contact);
}

/**
 * Jednotná field-level provenance pro identitní pole kontaktu (desktop + mobile).
 */
export function resolveContactIdentityFieldProvenance(
  fieldKey: string,
  provenance: ContactAiProvenanceResult | null,
): { kind: AiProvenanceKind; reviewId: string; confirmedAt?: string | null } | null {
  if (!provenance) return null;
  if (provenance.confirmedFields.includes(fieldKey)) {
    return { kind: "confirmed", reviewId: provenance.reviewId, confirmedAt: provenance.appliedAt };
  }
  if (provenance.autoAppliedFields.includes(fieldKey)) {
    return { kind: "auto_applied", reviewId: provenance.reviewId };
  }
  if (provenance.pendingFields.includes(fieldKey)) {
    return { kind: "pending_review", reviewId: provenance.reviewId };
  }
  if (provenance.manualRequiredFields.includes(fieldKey)) {
    return { kind: "manual", reviewId: provenance.reviewId };
  }
  return null;
}

/**
 * Zobrazit řádek identity tabulky, pokud má hodnotu nebo pending/manual stav.
 */
export function shouldShowContactIdentityRow(
  fieldKey: string,
  hasValue: boolean,
  provenance: ContactAiProvenanceResult | null,
): boolean {
  if (hasValue) return true;
  const p = resolveContactIdentityFieldProvenance(fieldKey, provenance);
  return p?.kind === "pending_review" || p?.kind === "manual";
}
