/**
 * Form-aware extraction: PDF AcroForm field truth, label-as-value rejection,
 * and generic role/column semantics for structured form PDFs.
 */

import type {
  DocumentReviewEnvelope,
  ExtractedField,
  PrimaryDocumentType,
  SourceKind,
} from "./document-review-types";
import type { PdfFormFieldRow } from "@/lib/documents/processing/pdf-acroform-extract";

const MAX_PROMPT_BLOCK_CHARS = 12_000;

/** Standalone role/column tokens — must never be accepted as a person's name or contract value. */
const LABEL_ONLY_NORMALIZED = new Set(
  [
    "investor",
    "investor:",
    "klient",
    "client",
    "pojistnik",
    "pojisteny",
    "distributor",
    "zprostredkovatel",
    "zprostředkovatel",
    "vazany zastupce",
    "vázaný zástupce",
    "makler",
    "makléř",
    "poradce",
    "pojistnikpojisteny",
    "pojistník",
    "pojištěný",
    "ucastnik",
    "účastník",
    "jméno",
    "prijmeni",
    "příjmení",
    "jmeno",
    "adresa",
    "telefon",
    "email",
    "e-mail",
    "rodne cislo",
    "rodnečíslo",
    "cislo smlouvy",
    "číslo smlouvy",
    "cislo pojistne smlouvy",
    "platnost",
    "vydal",
    "doklad",
    "ucet",
    "účet",
    "banka",
    "kod banky",
    "kód banky",
    "instituce",
    "poskytovatel",
    "pojistovna",
    "pojišťovna",
    "investicni spolecnost",
    "investiční společnost",
    "smlouva o upisu",
    "smlouva o úpisu",
    "navrh smlouvy o upisu",
    "návrh smlouvy o úpisu",
    "navrh smlouvy o úpisu",
    "predpokladana vyse investice",
    "předpokládaná výše investice",
  ].map((s) => normalizeLoose(s)),
);

function normalizeLoose(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True if the string is only a generic label / role name, not a filled value. */
export function isPlausibleLabelOnlyValue(raw: unknown): boolean {
  if (raw == null) return true;
  const s = String(raw).trim();
  if (!s) return true;
  const n = normalizeLoose(s);
  if (LABEL_ONLY_NORMALIZED.has(n)) return true;
  if (/^číslo\s+smlouvy/i.test(s)) return true;
  if (/^č\.\s*smlouvy/i.test(s)) return true;
  if (/^investor\s*:?\s*$/i.test(s)) return true;
  if (/^pojistník\s*:?\s*$/i.test(s)) return true;
  if (/^pojištěný\s*:?\s*$/i.test(s)) return true;
  // Document / section titles mistaken for contract numbers or names (no policy id digits)
  if (!/\d/.test(s) && /^smlouva\s+o\s+/i.test(s)) return true;
  if (!/\d/.test(s) && /^(návrh|dodatek|příloha)\s+smlouvy/i.test(s)) return true;
  if (!/\d/.test(s) && /^návrh\s+smlouvy\s+o\s+/i.test(s)) return true;
  // Repeated label words without digits (e.g. "číslo smlouvy investora")
  if (!/\d/.test(s) && /^[\p{L}\s\/\-:]+$/u.test(s) && n.split(/\s+/).length <= 6) {
    const words = n.split(/\s+/).filter(Boolean);
    const labelHits = words.filter((w) =>
      ["cislo", "smlouvy", "investora", "pojistneho", "pojistnik", "smlouva"].includes(w),
    );
    if (labelHits.length >= 2) return true;
  }
  return false;
}

function isPresentCell(f: ExtractedField | undefined): boolean {
  if (!f) return false;
  if (f.status === "missing" || f.status === "not_found" || f.status === "not_applicable") return false;
  const v = f.value;
  if (v == null) return false;
  const t = String(v).trim();
  return t !== "" && t !== "—";
}

function makeCell(
  value: string,
  opts: { page?: number; sourceKind?: SourceKind; sourceLabel?: string } = {},
): ExtractedField {
  return {
    value,
    status: "extracted",
    confidence: 0.95,
    sourcePage: opts.page,
    evidenceSnippet: "[pdf_acroform_field]",
    evidenceTier: "explicit_table_field",
    sourceKind: opts.sourceKind ?? "client_block",
    sourceLabel: opts.sourceLabel,
  };
}

function shouldPreferFormOverModel(modelVal: unknown, formVal: string): boolean {
  if (!formVal.trim()) return false;
  if (!isPresentCell({ value: modelVal, status: "extracted" } as ExtractedField)) return true;
  const m = String(modelVal).trim();
  if (isPlausibleLabelOnlyValue(m)) return true;
  if (normalizeLoose(m) === normalizeLoose(formVal)) return false;
  return true;
}

type CanonicalKey =
  | "fullName"
  | "clientFullName"
  | "investorFullName"
  | "contractNumber"
  | "personalId"
  | "email"
  | "phone"
  | "permanentAddress"
  | "bankAccount"
  | "recipientAccount"
  | "bankCode"
  | "oneOffAmount"
  | "investmentPremium"
  | "institutionName"
  | "idCardNumber"
  | "idCardIssuedBy"
  | "idCardValidUntil"
  | "intermediaryName"
  | "intermediaryCompany";

interface MappedField {
  key: CanonicalKey;
  value: string;
  page?: number;
}

function parseDomesticBankLine(raw: string): { account: string; bankCode?: string } {
  const t = raw.trim();
  const m = t.match(/^([\d\s]+)\s*\/\s*(\d{4})$/);
  if (m) {
    return { account: m[1]!.replace(/\s/g, ""), bankCode: m[2]! };
  }
  return { account: t.replace(/\s/g, "") };
}

/**
 * Distinguish client/investor bank fields from institution/platform/recipient payment targets
 * using only generic PDF field-path semantics (no issuer/vendor lists).
 */
function bankFieldTargetsClient(name: string): boolean {
  const n = name.toLowerCase();
  if (
    /recipient|payee|beneficiary|creditor|institution|platform|issuer|investmentcompany|investment\.|spravce|správce|fondmanager|fundmanager|issuerbank|platformbank|institutionbank|payment\.(to|receiver|target)|platba.*(prijem|příjem)|ucet.*(instituc|spravce)/i.test(
      n,
    )
  ) {
    return false;
  }
  if (
    /(^|\.)(customer|client|investor|participant|policyholder|insured|klient|ucastnik|účastník)\./i.test(n) ||
    /^person\./i.test(n)
  ) {
    return true;
  }
  // Default: ambiguous standalone widgets (e.g. "joinedBank") — treat as client for subscription forms
  return true;
}

/**
 * Map internal PDF field names to canonical extractedFields using generic patterns
 * (common in European investment/insurance PDF toolkits). No vendor lists.
 */
function mapRowToCanonical(row: PdfFormFieldRow, primary: PrimaryDocumentType): MappedField[] {
  const name = row.fieldName;
  const val = row.fieldValue.trim();
  const page = row.page;
  const lower = name.toLowerCase();

  const out: MappedField[] = [];
  const isInvestmentish =
    primary === "investment_subscription_document" ||
    primary === "investment_service_agreement" ||
    primary === "investment_modelation" ||
    primary === "investment_payment_instruction" ||
    primary === "pension_contract" ||
    primary === "generic_financial_document";

  const isClientPersonField =
    /(^|\.)joinedname$/i.test(name) ||
    /(customer|client|policyholder|insured|participant|investor)\.fullname$/i.test(name) ||
    /(customer|client|policyholder|insured)\.name$/i.test(name);

  if (isClientPersonField && !/(consultant|distributor|broker|intermediary|agent|vazany|makl)/i.test(name)) {
    out.push({ key: "fullName", value: val, page });
    out.push({ key: "clientFullName", value: val, page });
    if (isInvestmentish || /investor|investment|participant|policyholder|insured/i.test(name)) {
      out.push({ key: "investorFullName", value: val, page });
    }
    return out;
  }

  if (lower === "no" || /(^|\.)contractnumber$/i.test(name) || /(^|\.)policynumber$/i.test(name)) {
    if (/^\d{4,12}$/.test(val.replace(/\s/g, "")) || /^[A-Z0-9/-]{4,}$/i.test(val)) {
      out.push({ key: "contractNumber", value: val, page });
    }
    return out;
  }

  if (/(^|\.)id$/i.test(name) && /customer|participant|policyholder/i.test(name) && /^\d{6,10}$/.test(val.replace(/\s/g, ""))) {
    out.push({ key: "personalId", value: val, page });
    return out;
  }

  if (/document\.joinedid|idnumber|id_card|passport/i.test(name)) {
    out.push({ key: "idCardNumber", value: val, page });
    return out;
  }
  if (/document\.issuedby|issuedby|vydal/i.test(name)) {
    out.push({ key: "idCardIssuedBy", value: val, page });
    return out;
  }
  if (/document\.validity|validuntil|platnost/i.test(name)) {
    out.push({ key: "idCardValidUntil", value: val, page });
    return out;
  }

  if (/contact\.email|\.email$/i.test(name) && /@/.test(val)) {
    out.push({ key: "email", value: val, page });
    return out;
  }
  if (/contact\.phone|\.phone$/i.test(name) && /[\d+]/.test(val)) {
    out.push({ key: "phone", value: val, page });
    return out;
  }

  if (/joinedbank|bankaccount|accountnumber|iban|domesticaccount/i.test(name)) {
    if (/(^|\.)distributor\.|(^|\.)intermediary\.|(^|\.)broker\.|(^|\.)consultant\.|(^|\.)agent\.|^vazany/i.test(name)) {
      return out;
    }
    const parsed = parseDomesticBankLine(val);
    const forClient = bankFieldTargetsClient(name);
    if (forClient) {
      out.push({ key: "bankAccount", value: parsed.account, page });
      if (parsed.bankCode) {
        out.push({ key: "bankCode", value: parsed.bankCode, page });
      }
    } else {
      // Institution / platform collection account — never merge into client bankAccount
      const combined =
        parsed.bankCode && parsed.account ? `${parsed.account}/${parsed.bankCode}` : val.trim().replace(/\s/g, "");
      out.push({ key: "recipientAccount", value: combined || parsed.account, page });
    }
    return out;
  }

  if (/investmentestimated|estimatedinvest|predpoklad|plannedinvest/i.test(name)) {
    out.push({ key: "oneOffAmount", value: val, page });
    out.push({ key: "investmentPremium", value: val, page });
    return out;
  }

  if (
    lower === "companysign" ||
    /issuer|institution\.name|investmentcompany|pojistitel|insurer\.name|company\.issuer/i.test(name)
  ) {
    if (/\b(a\.s\.|s\.r\.o\.|společnost|spořitelna|banka|pojišťovna|investiční)/i.test(val)) {
      out.push({ key: "institutionName", value: val, page });
    }
    return out;
  }

  if (
    /^consultant\./i.test(name) ||
    /^distributor\./i.test(name) ||
    /^intermediary\./i.test(name) ||
    /^broker\./i.test(name) ||
    /^agent\./i.test(name) ||
    /^vazany/i.test(name) ||
    /(?:^|\.)intermediary\.|(?:^|\.)broker\.|(?:^|\.)agent\./i.test(name)
  ) {
    if (/company|firm|s\.r\.o|a\.s/i.test(name)) {
      out.push({ key: "intermediaryCompany", value: val, page });
    } else if (/name|person|phone|email/i.test(name)) {
      const looksCompany = /\b(s\.r\.o\.|a\.s\.|spol\.)/i.test(val);
      out.push({
        key: looksCompany ? "intermediaryCompany" : "intermediaryName",
        value: val,
        page,
      });
    }
    return out;
  }

  if (/address\.(street|line1)/i.test(name)) {
    out.push({ key: "permanentAddress", value: val, page });
    return out;
  }

  return out;
}

/** Compose address from multiple form rows when possible. */
function composeAddressFromRows(rows: PdfFormFieldRow[]): string | null {
  const street = rows.find((r) => /address\.street|\.street$/i.test(r.fieldName))?.fieldValue?.trim();
  const code = rows.find((r) => /address\.(code|zip|psc)/i.test(r.fieldName))?.fieldValue?.trim();
  const cityLine = rows.find((r) => /address\.(city|joinedcountry|municipality)/i.test(r.fieldName))?.fieldValue?.trim();
  const parts = [street, [code, cityLine].filter(Boolean).join(" ")].filter(Boolean);
  const s = parts.join(", ").trim();
  return s.length > 5 ? s : null;
}

/**
 * Merge PDF AcroForm field values into extractedFields — authoritative over layout heuristics.
 */
export function applyPdfFormFieldTruthToEnvelope(
  envelope: DocumentReviewEnvelope,
  rows: PdfFormFieldRow[] | null | undefined,
): void {
  if (!rows?.length) return;
  const ef = envelope.extractedFields;
  const primary = envelope.documentClassification.primaryType;
  const composedAddr = composeAddressFromRows(rows);

  const merged = new Map<CanonicalKey, MappedField>();
  for (const row of rows) {
    for (const m of mapRowToCanonical(row, primary)) {
      if (!merged.has(m.key)) merged.set(m.key, m);
    }
  }
  if (composedAddr) {
    const existing = merged.get("permanentAddress");
    if (!existing || composedAddr.length > String(existing.value).length + 4) {
      merged.set("permanentAddress", {
        key: "permanentAddress",
        value: composedAddr,
        page: rows[0]?.page,
      });
    }
  }

  for (const { key, value, page } of merged.values()) {
    if (!value.trim()) continue;
    const existing = ef[key];
    if (!shouldPreferFormOverModel(existing?.value, value)) continue;
    const sk: SourceKind =
      key === "institutionName"
        ? "provider_header"
        : key === "intermediaryName" || key === "intermediaryCompany"
          ? "intermediary_block"
          : key === "bankAccount" || key === "bankCode"
            ? "payment_block"
            : key === "recipientAccount"
              ? "payment_block"
              : "client_block";
    ef[key] = makeCell(value, {
      page,
      sourceKind: sk,
      sourceLabel: "PDF formulářové pole",
    });
  }
}

/**
 * Clear extracted values that are clearly column labels / roles, not real answers.
 */
export function stripLabelOnlyExtractionValues(envelope: DocumentReviewEnvelope): void {
  const ef = envelope.extractedFields;
  const keys: (keyof typeof ef)[] = [
    "fullName",
    "clientFullName",
    "investorFullName",
    "policyholderName",
    "insuredPersonName",
    "contractNumber",
    "proposalNumber",
    "proposalNumber_or_contractNumber",
    "contractNumber_or_proposalNumber",
    "productName",
    "personalId",
    "birthDate",
    "email",
    "phone",
    "permanentAddress",
    "idCardNumber",
    "idCardIssuedBy",
    "idCardValidUntil",
    "bankAccount",
    "recipientAccount",
    "bankCode",
    "oneOffAmount",
    "investmentPremium",
    "institutionName",
  ];
  for (const k of keys) {
    const cell = ef[k];
    if (!cell || !isPresentCell(cell)) continue;
    if (isPlausibleLabelOnlyValue(cell.value)) {
      ef[k] = {
        value: null,
        status: "missing",
        confidence: typeof cell.confidence === "number" ? cell.confidence : 0.4,
        evidenceSnippet: cell.evidenceSnippet,
        sourcePage: cell.sourcePage,
      };
    }
  }
}

/**
 * Czech prompt block: instructs the model to prefer these values over visual layout guesses.
 */
export function buildPdfFormFieldPromptBlock(rows: PdfFormFieldRow[]): string {
  if (!rows.length) return "";
  const lines = rows
    .filter((r) => r.fieldValue.trim() && r.fieldValue !== "Off")
    .slice(0, 220)
    .map((r) => `- (${r.page}) ${r.fieldName}: ${r.fieldValue}`);
  const body = lines.join("\n");
  const capped = body.length > MAX_PROMPT_BLOCK_CHARS ? body.slice(0, MAX_PROMPT_BLOCK_CHARS) + "\n…" : body;
  return `VYPLNĚNÁ PDF FORMULÁŘOVÁ POLE (AcroForm — primární zdroj pravdy pro hodnoty, ne pro názvy kolonek):
${capped}

Pravidla:
- Pokud se textová vrstva nebo layout rozchází s tímto seznamem, použij hodnoty z tohoto seznamu.
- Řetězce typu „Investor“, „Pojistník“, „Číslo smlouvy“ jsou názvy rolí/kolonek — nikdy je neextrahuj jako jméno osoby ani jako číslo smlouvy.
- Jméno klienta/investora ber z pole, které odpovídá vyplněnému jménu (např. joinedName), ne z nadpisu role.
- Blok zprostředkovatele / distributora nesmí být zaměněn s klientem.
`;
}
