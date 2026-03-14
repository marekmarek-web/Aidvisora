/**
 * Extraction schemas by document type for the contract understanding pipeline.
 * Each type has common fields plus type-specific fields; schema selection drives the extraction prompt.
 */

import { z } from "zod";
import type { ContractDocumentType } from "./document-classification";

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
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  birthDate: z.string().optional(),
  personalId: z.string().optional(),
  companyId: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

/** Payment details (common). */
const paymentDetailsSchema = z.object({
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  frequency: z.string().optional(),
  iban: z.string().optional(),
  accountNumber: z.string().optional(),
  bankCode: z.string().optional(),
  variableSymbol: z.string().optional(),
  firstPaymentDate: z.string().optional(),
});

/** Common + optional type-specific fields; one schema validates all extraction outputs. */
export const extractedContractByTypeSchema = z.object({
  documentType: z.string().optional(),
  contractNumber: z.string().optional(),
  institutionName: z.string().optional(),
  productName: z.string().optional(),
  client: clientSchema.optional(),
  paymentDetails: paymentDetailsSchema.optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  notes: z.array(z.string()).optional(),
  missingFields: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  needsHumanReview: z.boolean().optional(),
  /** Section-level confidence (contract, client, institution, product, paymentDetails, dates). */
  fieldConfidenceMap: z.record(z.string(), z.number()).optional(),
  // Type-specific (insurance)
  policyType: z.string().optional(),
  insuredObject: z.string().optional(),
  premium: z.union([z.number(), z.string()]).optional(),
  beneficiary: z.string().optional(),
  // Type-specific (investment)
  productType: z.string().optional(),
  riskClass: z.string().optional(),
  fundName: z.string().optional(),
  contributionAmount: z.union([z.number(), z.string()]).optional(),
  // Type-specific (loan/mortgage)
  loanAmount: z.union([z.number(), z.string()]).optional(),
  interestRate: z.union([z.number(), z.string()]).optional(),
  maturity: z.string().optional(),
  collateral: z.string().optional(),
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
