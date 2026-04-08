/**
 * Identity document (OP / pas / povolení k pobytu) → návrh kontaktu pro createContact.
 * Mapuje jen na existující contacts schema; typ dokladu/platnost → notes.
 */

import type { ExtractedFactBundle, InputClassificationResult, DocumentMultiImageResult } from "./types";

function factVal(bundle: ExtractedFactBundle, key: string): string | null {
  const f = bundle.facts.find((x) => x.factKey === key);
  const v = f?.value;
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function factConf(bundle: ExtractedFactBundle, key: string): number {
  return bundle.facts.find((x) => x.factKey === key)?.confidence ?? 0;
}

/**
 * Konzervativní: jen photo_or_scan_document + signály identity dokladu, ne smlouva.
 */
export function detectIdentityContactIntakeSignals(
  classification: InputClassificationResult | null,
  factBundle: ExtractedFactBundle,
  documentSetResult: DocumentMultiImageResult | null,
): boolean {
  if (!classification || classification.inputType !== "photo_or_scan_document") return false;

  const contractLike = factBundle.facts.some(
    (f) =>
      f.factKey === "looks_like_contract" &&
      String(f.value).toLowerCase().includes("yes") &&
      f.confidence >= 0.55,
  );
  if (contractLike) return false;

  const idYes = factBundle.facts.some(
    (f) =>
      f.factKey === "id_doc_is_identity_document" &&
      String(f.value).toLowerCase().includes("yes") &&
      f.confidence >= 0.5,
  );

  const docType = (factVal(factBundle, "document_type") ?? "").toLowerCase();
  const docHint =
    /občan|obcan|op\b|pas|povolen|pobyt|cestov|identity|řidič|ridič/i.test(docType) ||
    /občan|obcan|op\b|pas|povolen|pobyt/i.test(factVal(factBundle, "document_summary") ?? "");

  const hasName =
    factVal(factBundle, "id_doc_first_name") &&
    factVal(factBundle, "id_doc_last_name") &&
    factConf(factBundle, "id_doc_first_name") >= 0.45 &&
    factConf(factBundle, "id_doc_last_name") >= 0.45;

  if (documentSetResult?.decision === "mixed_document_set") return false;
  if (documentSetResult?.decision === "supporting_reference_set") return false;
  if (documentSetResult?.decision === "review_handoff_candidate") return false;

  return idYes || docHint || Boolean(hasName);
}

export type CreateContactDraftFromIdDoc = {
  /** Parametry pro createContact / execution step (jen povolená pole). */
  params: Record<string, string | undefined>;
  /** Sloučí document summary + typ dokladu do notes. */
  notesSections: string[];
  /** Lidské popisy pro UI „doplnit“. */
  missingAdvisorLines: string[];
  /** Klíče k potvrzení (nízká jistota / inferred). */
  needsConfirmationLines: string[];
};

function appendNote(parts: string[], title: string, body: string | null | undefined) {
  const b = body?.trim();
  if (b) parts.push(`${title}: ${b}`);
}

export function mapFactBundleToCreateContactDraft(factBundle: ExtractedFactBundle): CreateContactDraftFromIdDoc {
  const notesSections: string[] = [];
  appendNote(notesSections, "Typ dokladu / shrnutí", factVal(factBundle, "document_type"));
  appendNote(notesSections, "Obsah dokumentu", factVal(factBundle, "document_summary"));
  appendNote(notesSections, "Platnost / doplněk z dokladu", factVal(factBundle, "id_doc_extra_notes"));

  const get = (k: string) => factVal(factBundle, k);
  const conf = (k: string) => factConf(factBundle, k);

  const params: Record<string, string | undefined> = {
    firstName: get("id_doc_first_name") ?? undefined,
    lastName: get("id_doc_last_name") ?? undefined,
    birthDate: get("id_doc_birth_date") ?? undefined,
    street: get("id_doc_street") ?? undefined,
    city: get("id_doc_city") ?? undefined,
    zip: get("id_doc_zip") ?? undefined,
    personalId: get("id_doc_personal_id") ?? undefined,
    email: get("id_doc_email") ?? undefined,
    phone: get("id_doc_phone") ?? undefined,
    title: get("id_doc_title") ?? undefined,
  };

  const missingAdvisorLines: string[] = [];
  const needsConfirmationLines: string[] = [];

  if (!params.firstName?.trim()) missingAdvisorLines.push("Jméno");
  if (!params.lastName?.trim()) missingAdvisorLines.push("Příjmení");

  const lowConfFields: { fk: string; label: string }[] = [
    { fk: "id_doc_first_name", label: "Jméno" },
    { fk: "id_doc_last_name", label: "Příjmení" },
    { fk: "id_doc_birth_date", label: "Datum narození" },
    { fk: "id_doc_street", label: "Ulice" },
    { fk: "id_doc_city", label: "Město" },
    { fk: "id_doc_zip", label: "PSČ" },
  ];
  for (const { fk, label } of lowConfFields) {
    if (!factVal(factBundle, fk)) continue;
    const f = factBundle.facts.find((x) => x.factKey === fk);
    if (f && (f.confidence < 0.65 || f.observedVsInferred === "inferred")) {
      const line = `${label} — ověřte`;
      if (!needsConfirmationLines.includes(line)) needsConfirmationLines.push(line);
    }
  }

  if (params.personalId?.trim()) {
    needsConfirmationLines.push("Rodné číslo / osobní údaj z dokladu — potvrďte před uložením");
  }

  const notes =
    [`[Z dokladu — AI extrakce]`, ...notesSections, ...factBundle.missingFields.map((m) => `Chybějící: ${m}`)]
      .filter(Boolean)
      .join("\n")
      .slice(0, 8000) || undefined;
  if (notes) params.notes = notes;

  return { params, notesSections, missingAdvisorLines, needsConfirmationLines };
}

/** Query string pro /portal/contacts/new (jen neprázdné hodnoty). */
export function buildContactNewPrefillQuery(draft: CreateContactDraftFromIdDoc): string {
  const q = new URLSearchParams();
  const p = draft.params;
  const entries: [string, string | undefined][] = [
    ["firstName", p.firstName],
    ["lastName", p.lastName],
    ["birthDate", p.birthDate],
    ["street", p.street],
    ["city", p.city],
    ["zip", p.zip],
    ["personalId", p.personalId],
    ["email", p.email],
    ["phone", p.phone],
    ["title", p.title],
    ["notes", p.notes],
  ];
  for (const [k, v] of entries) {
    if (v && String(v).trim()) q.set(k, String(v).trim());
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
