/**
 * Extraction schemas by document type for the contract understanding pipeline.
 * Each type has common fields plus type-specific fields; schema selection drives the extraction prompt.
 */

import { z } from "zod";
import type { ContractDocumentType } from "./document-classification";

/**
 * OpenAI structured JSON often uses `null` for missing optional fields.
 * Zod's `.optional()` only allows `undefined`, not `null` — without this, validation fails
 * e.g. on paymentDetails.iban: null (common for loan contracts without IBAN in PDF).
 */
function jsonOptionalString() {
  return z.preprocess((val: unknown) => (val === null ? undefined : val), z.string().optional());
}

function jsonOptionalAmount() {
  return z.preprocess(
    (val: unknown) => (val === null ? undefined : val),
    z.union([z.number(), z.string()]).optional()
  );
}

function jsonOptionalConfidence() {
  return z.preprocess(
    (val: unknown) => (val === null ? undefined : val),
    z.number().min(0).max(1).optional()
  );
}

function jsonOptionalBoolean() {
  return z.preprocess((val: unknown) => (val === null ? undefined : val), z.boolean().optional());
}

function jsonOptionalStringArray() {
  return z.preprocess(
    (val: unknown) => (val === null ? undefined : val),
    z.array(z.string()).optional()
  );
}

function jsonOptionalFieldConfidenceMap() {
  return z.preprocess(
    (val: unknown) => (val === null ? undefined : val),
    z.record(z.string(), z.number()).optional()
  );
}

/** Section-level confidence keys returned by the model. */
export const SECTION_CONFIDENCE_KEYS = [
  "contract",
  "client",
  "institution",
  "product",
  "paymentDetails",
  "dates",
] as const;

export type SectionConfidenceKey = (typeof SECTION_CONFIDENCE_KEYS)[number];

export const sectionConfidenceMapSchema = z.record(
  z.enum(SECTION_CONFIDENCE_KEYS),
  z.number().min(0).max(1)
).optional();

/** Client block (common). */
const clientSchema = z.object({
  fullName: jsonOptionalString(),
  firstName: jsonOptionalString(),
  lastName: jsonOptionalString(),
  birthDate: jsonOptionalString(),
  personalId: jsonOptionalString(),
  companyId: jsonOptionalString(),
  email: jsonOptionalString(),
  phone: jsonOptionalString(),
  address: jsonOptionalString(),
});

/** Payment details (common). */
const paymentDetailsSchema = z.object({
  amount: jsonOptionalAmount(),
  currency: jsonOptionalString(),
  frequency: jsonOptionalString(),
  iban: jsonOptionalString(),
  accountNumber: jsonOptionalString(),
  bankCode: jsonOptionalString(),
  variableSymbol: jsonOptionalString(),
  firstPaymentDate: jsonOptionalString(),
});

/** Common + optional type-specific fields; one schema validates all extraction outputs. */
export const extractedContractByTypeSchema = z.object({
  documentType: jsonOptionalString(),
  contractNumber: jsonOptionalString(),
  institutionName: jsonOptionalString(),
  productName: jsonOptionalString(),
  client: z.preprocess((v: unknown) => (v === null ? undefined : v), clientSchema.optional()),
  paymentDetails: z.preprocess((v: unknown) => (v === null ? undefined : v), paymentDetailsSchema.optional()),
  effectiveDate: jsonOptionalString(),
  expirationDate: jsonOptionalString(),
  notes: jsonOptionalStringArray(),
  missingFields: jsonOptionalStringArray(),
  confidence: jsonOptionalConfidence(),
  needsHumanReview: jsonOptionalBoolean(),
  /** Section-level confidence (contract, client, institution, product, paymentDetails, dates). */
  fieldConfidenceMap: jsonOptionalFieldConfidenceMap(),
  // Type-specific (insurance)
  policyType: jsonOptionalString(),
  insuredObject: jsonOptionalString(),
  premium: jsonOptionalAmount(),
  beneficiary: jsonOptionalString(),
  // Type-specific (investment)
  productType: jsonOptionalString(),
  riskClass: jsonOptionalString(),
  fundName: jsonOptionalString(),
  contributionAmount: jsonOptionalAmount(),
  // Type-specific (loan/mortgage)
  loanAmount: jsonOptionalAmount(),
  interestRate: jsonOptionalAmount(),
  maturity: jsonOptionalString(),
  collateral: jsonOptionalString(),
});

export type ExtractedContractByType = z.infer<typeof extractedContractByTypeSchema>;

export type SchemaPromptInfo = {
  schema: typeof extractedContractByTypeSchema;
  promptFragment: string;
};

const PROMPT_FRAGMENTS: Record<ContractDocumentType, string> = {
  insurance_contract: `Dokument je pojistná smlouva. Kromě běžných polí extrahuj též: policyType, insuredObject, premium, beneficiary (pokud jsou v dokumentu).`,
  investment_contract: `Dokument je investiční smlouva. Kromě běžných polí extrahuj též: productType, riskClass, fundName, contributionAmount (pokud jsou v dokumentu).`,
  loan_or_mortgage_contract: `Dokument je úvěrová nebo hypoteční smlouva. Kromě běžných polí extrahuj též: loanAmount, interestRate, maturity, collateral (pokud jsou v dokumentu).`,
  amendment: `Dokument je dodatkem ke smlouvě. Extrahuj běžná pole a identifikátory původní smlouvy (contractNumber, institutionName).`,
  application_or_proposal: `Dokument je žádost nebo návrh smlouvy. Extrahuj běžná pole; některé údaje mohou chybět.`,
  payment_document: `Dokument je platební doklad. Zaměř se na paymentDetails, institutionName, částky a datum.`,
  terms_and_conditions: `Dokument jsou obchodní podmínky. Extrahuj institutionName, produktové reference a datum platnosti, pokud jsou uvedeny.`,
  unknown: `Dokument je smlouva nebo příbuzný dokument neznámého typu. Extrahuj všechna běžná pole, která v dokumentu najdeš.`,
};

/**
 * Returns schema and prompt fragment for the given document type.
 */
export function getSchemaForDocumentType(
  documentType: ContractDocumentType
): SchemaPromptInfo {
  return {
    schema: extractedContractByTypeSchema,
    promptFragment: PROMPT_FRAGMENTS[documentType],
  };
}

/** Base extraction prompt (common part). */
export const EXTRACTION_PROMPT_BASE = `Extrahuj z přiloženého dokumentu strukturovaná data. Vrať JEDINĚ platný JSON objekt (žádný markdown, žádný úvod).

Povinná pole v odpovědi:
- documentType (string)
- contractNumber, institutionName, productName (string)
- client: { fullName?, firstName?, lastName?, birthDate?, personalId?, companyId?, email?, phone?, address? }
- paymentDetails: { amount?, currency?, frequency?, iban?, accountNumber?, bankCode?, variableSymbol?, firstPaymentDate? }
- effectiveDate, expirationDate (string, ISO nebo dd.mm.yyyy)
- notes (pole stringů)
- missingFields (pole názvů polí, která v dokumentu chybí)
- confidence (0–1, celková jistota extrakce)
- needsHumanReview (boolean)
- fieldConfidenceMap: objekt se sekcemi "contract", "client", "institution", "product", "paymentDetails", "dates" – u každé číslo 0–1 (jistota pro tu sekci)

`;

/**
 * Build full extraction prompt for a document type and optional scan hint.
 */
export function buildExtractionPrompt(
  documentType: ContractDocumentType,
  isScanFallback: boolean
): string {
  const { promptFragment } = getSchemaForDocumentType(documentType);
  const scanHint = isScanFallback
    ? " Dokument může být naskenovaný; pokud je text nečitelný, uveď to v notes a nastav nižší confidence.\n\n"
    : "";
  return EXTRACTION_PROMPT_BASE + scanHint + "Kontext: " + promptFragment;
}

/**
 * Parse and validate raw model output against the schema for the given document type.
 */
export function validateExtractionByType(
  raw: string,
  _documentType: ContractDocumentType
): { ok: true; data: ExtractedContractByType } | { ok: false; issues: z.ZodIssue[] } {
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      issues: [{ code: "custom", path: [], message: e instanceof Error ? e.message : String(e) }],
    };
  }
  const result = extractedContractByTypeSchema.safeParse(parsed);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, issues: result.error.issues };
}
