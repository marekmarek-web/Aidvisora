/**
 * Document classification for contract upload pipeline.
 * Classifies uploaded documents into known types for schema selection.
 */

import { z } from "zod";
import { createResponseWithFile } from "@/lib/openai";

export const CONTRACT_DOCUMENT_TYPES = [
  "insurance_contract",
  "investment_contract",
  "loan_or_mortgage_contract",
  "amendment",
  "application_or_proposal",
  "payment_document",
  "terms_and_conditions",
  "unknown",
] as const;

export type ContractDocumentType = (typeof CONTRACT_DOCUMENT_TYPES)[number];

export type ClassificationResult = {
  documentType: ContractDocumentType;
  confidence: number;
  reasons: string[];
};

const classificationResponseSchema = z.object({
  documentType: z.enum(CONTRACT_DOCUMENT_TYPES),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

const CLASSIFICATION_PROMPT = `Prohlédni přiložený dokument a urči jeho typ. Vrať JEDINĚ platný JSON objekt (žádný markdown, žádný úvod) s poli:
- documentType: jeden z přesně těchto hodnot: "insurance_contract", "investment_contract", "loan_or_mortgage_contract", "amendment", "application_or_proposal", "payment_document", "terms_and_conditions", "unknown"
- confidence: číslo 0–1 (jistota klasifikace)
- reasons: pole krátkých důvodů (česky nebo anglicky), proč jsi zvolil tento typ

Pouze platný JSON objekt.`;

/** Exported for unit tests. */
export function parseClassificationResponse(raw: string): ClassificationResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;
  const parsed = JSON.parse(jsonStr) as unknown;
  const result = classificationResponseSchema.safeParse(parsed);
  if (!result.success) {
    return {
      documentType: "unknown",
      confidence: 0,
      reasons: ["Parse error: " + result.error.message],
    };
  }
  return result.data;
}

/**
 * Classify a contract document by type using the file URL.
 * Returns documentType, confidence (0–1), and reasons.
 */
export async function classifyContractDocument(
  fileUrl: string
): Promise<ClassificationResult> {
  const raw = await createResponseWithFile(fileUrl, CLASSIFICATION_PROMPT);
  return parseClassificationResponse(raw);
}
