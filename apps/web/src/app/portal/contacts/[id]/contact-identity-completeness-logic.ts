/**
 * Fáze 14/15 + Slice 4.2: Čistá logika pro ContactIdentityCompletenessGuard.
 * Importovatelná jak z Client Componentů, tak z testů.
 *
 * REQUIRED fields: personalId, birthDate — chybějící zobrazuje výzvu k doplnění.
 * ADVISORY fields: idCardNumber, adresa (street+city+zip), kontakt (email|phone) — upozornění, ne blokující.
 */

/**
 * Stav identity pole pro completeness guard.
 * - "ok"           : pole je přítomno a potvrzeno nebo auto-aplikováno z AI Review
 * - "pending_ai"   : pole chybí v kontaktu, ale čeká na potvrzení v AI Review
 * - "manual"       : pole chybí, žádný AI pending zdroj, vyžaduje ruční doplnění
 */
export type IdentityFieldStatus = "ok" | "pending_ai" | "manual";

/** Kategorie pole — REQUIRED jsou povinné pro dokončení profilu, ADVISORY jsou doporučené. */
export type IdentityFieldCategory = "required" | "advisory";

export type IdentityFieldResult = {
  key: string;
  label: string;
  status: IdentityFieldStatus;
  category: IdentityFieldCategory;
};

export type ContactIdentityInput = {
  birthDate?: string | null;
  personalId?: string | null;
  idCardNumber?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ContactProvenanceInput = {
  reviewId: string;
  confirmedFields: string[];
  autoAppliedFields: string[];
  pendingFields: string[];
} | null;

/** REQUIRED identity fields — chybějící blokuje completeness. */
export const REQUIRED_IDENTITY_FIELDS: { key: string; label: string }[] = [
  { key: "birthDate", label: "Datum narození" },
  { key: "personalId", label: "Rodné číslo" },
];

/** ADVISORY fields — doporučené, ale ne povinné pro provoz. */
export const ADVISORY_IDENTITY_FIELDS: { key: string; label: string }[] = [
  { key: "idCardNumber", label: "Číslo dokladu (OP/pas)" },
  { key: "address", label: "Adresa (ulice, město, PSČ)" },
  { key: "contact", label: "Kontakt (e-mail nebo telefon)" },
];

function fieldHasValue(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function resolveFieldStatus(
  key: string,
  hasValue: boolean,
  provenance: ContactProvenanceInput,
): IdentityFieldStatus {
  if (hasValue) return "ok";
  if (provenance) {
    if (provenance.confirmedFields.includes(key) || provenance.autoAppliedFields.includes(key)) {
      return "ok";
    }
    if (provenance.pendingFields.includes(key)) return "pending_ai";
  }
  return "manual";
}

/**
 * Slice 4.2: Contact Identity Completeness Guard — čistá logická funkce.
 *
 * Vrací výsledky pro REQUIRED i ADVISORY skupiny.
 * Skupinová pole (address, contact) se tratují jako jeden záznam.
 */
export function resolveIdentityCompleteness(
  contact: ContactIdentityInput,
  provenance: ContactProvenanceInput,
): IdentityFieldResult[] {
  const results: IdentityFieldResult[] = [];

  // REQUIRED fields — jednotlivá pole
  for (const { key, label } of REQUIRED_IDENTITY_FIELDS) {
    const value = contact[key as keyof ContactIdentityInput];
    const hasValue = fieldHasValue(value);
    results.push({
      key,
      label,
      status: resolveFieldStatus(key, hasValue, provenance),
      category: "required",
    });
  }

  // Pokud jsou všechna povinná pole "ok", advisory pole bez dat a bez pending provenance
  // jsou tiché (guard mlčí) — advisory = doporučené, absence neblokuje.
  const allRequiredOk = results.every((r) => r.status === "ok");

  // ADVISORY: idCardNumber
  {
    const hasValue = fieldHasValue(contact.idCardNumber);
    let status: IdentityFieldStatus;
    if (hasValue) {
      status = "ok";
    } else if (provenance) {
      if (
        provenance.confirmedFields.includes("idCardNumber") ||
        provenance.autoAppliedFields.includes("idCardNumber")
      ) {
        status = "ok";
      } else if (provenance.pendingFields.includes("idCardNumber")) {
        status = "pending_ai";
      } else {
        status = allRequiredOk ? "ok" : "manual";
      }
    } else {
      status = allRequiredOk ? "ok" : "manual";
    }
    results.push({
      key: "idCardNumber",
      label: "Číslo dokladu (OP/pas)",
      status,
      category: "advisory",
    });
  }

  // ADVISORY: adresa jako skupina — ok pokud je vyplněno alespoň ulice + město nebo PSČ
  {
    const hasAddress =
      fieldHasValue(contact.street) &&
      (fieldHasValue(contact.city) || fieldHasValue(contact.zip));
    const addressKeys = ["street", "city", "zip"];
    let addressStatus: IdentityFieldStatus;
    if (hasAddress) {
      addressStatus = "ok";
    } else if (provenance) {
      const anyConfirmed = addressKeys.some(
        (k) =>
          provenance.confirmedFields.includes(k) || provenance.autoAppliedFields.includes(k)
      );
      const anyPending = addressKeys.some((k) => provenance.pendingFields.includes(k));
      if (anyConfirmed) addressStatus = "ok";
      else if (anyPending) addressStatus = "pending_ai";
      else addressStatus = allRequiredOk ? "ok" : "manual";
    } else {
      addressStatus = allRequiredOk ? "ok" : "manual";
    }
    results.push({
      key: "address",
      label: "Adresa (ulice, město, PSČ)",
      status: addressStatus,
      category: "advisory",
    });
  }

  // ADVISORY: kontakt — ok pokud je email NEBO telefon
  {
    const hasContact = fieldHasValue(contact.email) || fieldHasValue(contact.phone);
    const contactKeys = ["email", "phone"];
    let contactStatus: IdentityFieldStatus;
    if (hasContact) {
      contactStatus = "ok";
    } else if (provenance) {
      const anyConfirmed = contactKeys.some(
        (k) =>
          provenance.confirmedFields.includes(k) || provenance.autoAppliedFields.includes(k)
      );
      const anyPending = contactKeys.some((k) => provenance.pendingFields.includes(k));
      if (anyConfirmed) contactStatus = "ok";
      else if (anyPending) contactStatus = "pending_ai";
      else contactStatus = allRequiredOk ? "ok" : "manual";
    } else {
      contactStatus = allRequiredOk ? "ok" : "manual";
    }
    results.push({
      key: "contact",
      label: "Kontakt (e-mail nebo telefon)",
      status: contactStatus,
      category: "advisory",
    });
  }

  return results;
}

/**
 * Sestaví srozumitelnou zprávu pro uživatele.
 * Rozlišuje REQUIRED vs ADVISORY sekce.
 */
export function buildIncompleteMessage(incomplete: IdentityFieldResult[]): string {
  const required = incomplete.filter((r) => r.category === "required" && r.status !== "ok");
  const advisory = incomplete.filter((r) => r.category === "advisory" && r.status !== "ok");

  const parts: string[] = [];

  for (const group of [
    { items: required, prefix: "Povinné údaje chybí" },
    { items: advisory, prefix: "Doporučené údaje chybí" },
  ]) {
    if (group.items.length === 0) continue;
    const pendingAi = group.items.filter((r) => r.status === "pending_ai");
    const manual = group.items.filter((r) => r.status === "manual");
    if (pendingAi.length > 0) {
      const labels = pendingAi.map((f) => f.label).join(", ");
      parts.push(
        pendingAi.length === 1
          ? `${labels} čeká na potvrzení z AI Review.`
          : `${labels} čekají na potvrzení z AI Review.`
      );
    }
    if (manual.length > 0) {
      const labels = manual.map((f) => f.label).join(", ");
      parts.push(
        manual.length === 1
          ? `${labels} vyžaduje ruční doplnění.`
          : `${labels} vyžadují ruční doplnění.`
      );
    }
  }

  return parts.join(" ");
}
