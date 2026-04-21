/**
 * =========================================================================
 *  EXTRACTION SCHEMAS — LEGACY / COMPATIBILITY SHIM
 * =========================================================================
 *
 *  Single source of truth hierarchy (FL-2.5 consolidation):
 *
 *    1. `document-review-types.ts` → `DocumentReviewEnvelope` (canonical).
 *    2. `document-schema-registry.ts` → per-document-type extraction rules
 *       (`DocumentSchemaDefinition`, `DocumentSchemaPromptBundle`).
 *    3. `document-schema-router.ts` → maps `ContractDocumentType` → schema.
 *    4. `extraction-schemas-by-type.ts` → public API façade that composes
 *       (1)+(2)+(3) and returns the canonical envelope from a raw model
 *       response. **New code MUST use this façade.**
 *
 *  This file exists ONLY for:
 *
 *    A. `validateContactExtraction()` — AI asistent extrakce kontaktů z
 *       volného textu (CRM „chytré vložení kontaktů“). Flat contact schema
 *       is not part of the document-review envelope world, so it stays here
 *       as a standalone util.
 *    B. `extractedContractSchema` (flat contract view) — legacy compat layer
 *       used by `lib/portfolio/from-document-extraction.ts` when mapping
 *       stored extract JSON into portfolio attributes. Do not propagate to
 *       new call sites. When refactoring the portfolio path, migrate to the
 *       canonical envelope via `extraction-schemas-by-type.ts`.
 *
 *  REMOVED IN THIS FILE (was dead code):
 *  - `validateContractExtraction()` — no caller; canonical path is
 *    `validateExtractionByType()` from `extraction-schemas-by-type.ts`.
 */

import { z } from "zod";
import { zodIssuesToAdvisorBriefMessages } from "./zod-issues-advisor-copy";

/**
 * Zod schema pro jeden extrahovaný kontakt (CRM „chytré vložení kontaktů"
 * z volného textu / e-mailu). Není součástí document-review envelope.
 */
export const extractedContactSchema = z.object({
  companyName: z.string().optional(),
  ico: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export type ExtractedContactSchema = z.infer<typeof extractedContactSchema>;

export const extractedContactArraySchema = z.array(extractedContactSchema);

/** Client block inside legacy flat contract view. */
const extractedContractClientSchema = z.object({
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

/** Payment details block inside legacy flat contract view. */
const extractedContractPaymentDetailsSchema = z.object({
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  frequency: z.string().optional(),
  iban: z.string().optional(),
  accountNumber: z.string().optional(),
  bankCode: z.string().optional(),
  variableSymbol: z.string().optional(),
  firstPaymentDate: z.string().optional(),
});

/**
 * Legacy flat contract view. **Do not use in new code** — use the canonical
 * `DocumentReviewEnvelope` + `validateExtractionByType()` instead.
 *
 * Kept alive for the portfolio sync path, which reads stored extract JSON
 * produced before the envelope migration.
 */
export const extractedContractSchema = z.object({
  documentType: z.string().optional(),
  contractNumber: z.string().optional(),
  institutionName: z.string().optional(),
  productName: z.string().optional(),
  client: extractedContractClientSchema.optional(),
  paymentDetails: extractedContractPaymentDetailsSchema.optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  notes: z.array(z.string()).optional(),
  missingFields: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  needsHumanReview: z.boolean().optional(),
});

export type ExtractedContractSchema = z.infer<typeof extractedContractSchema>;

export type ExtractionValidationError = {
  code: "VALIDATION_FAILED";
  message: string;
  issues: z.ZodIssue[];
};

/**
 * Validate raw string (e.g. from createResponse) as JSON array of contacts.
 * Returns parsed data or a controlled error; never silent fail.
 */
export function validateContactExtraction(
  raw: string,
): { ok: true; data: ExtractedContactSchema[] } | { ok: false; error: ExtractionValidationError } {
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Neplatný JSON v odpovědi modelu.",
        issues: [{ code: "custom", path: [], message: e instanceof Error ? e.message : String(e) }],
      },
    };
  }

  const result = extractedContactArraySchema.safeParse(parsed);
  if (result.success) {
    const filtered = result.data.filter(
      (c) => c.companyName || c.firstName || c.lastName || c.phone || c.email,
    );
    return { ok: true, data: filtered };
  }

  const brief = zodIssuesToAdvisorBriefMessages(result.error.issues, 4);
  return {
    ok: false,
    error: {
      code: "VALIDATION_FAILED",
      message: brief[0] ?? "Odpověď modelu nevyhovuje schématu kontaktů.",
      issues: result.error.issues,
    },
  };
}
