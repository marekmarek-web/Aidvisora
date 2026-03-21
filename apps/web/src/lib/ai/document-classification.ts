import { z } from "zod";
import { createResponseWithFile } from "@/lib/openai";
import {
  DOCUMENT_LIFECYCLE_STATUSES,
  PRIMARY_DOCUMENT_TYPES,
  type DocumentClassification,
} from "./document-review-types";
import { classifyLifecycleFromPrimary } from "./document-schema-registry";

export type ClassificationResult = DocumentClassification;
export type ContractDocumentType = (typeof PRIMARY_DOCUMENT_TYPES)[number];
export const CONTRACT_DOCUMENT_TYPES = PRIMARY_DOCUMENT_TYPES;

const classificationResponseSchema = z.object({
  primaryType: z.enum(PRIMARY_DOCUMENT_TYPES),
  subtype: z.string().min(1).max(120).optional(),
  lifecycleStatus: z.enum(DOCUMENT_LIFECYCLE_STATUSES).optional(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

const CLASSIFICATION_PROMPT = `Urči klasifikaci finančního dokumentu.
Vrať JEDINĚ platný JSON objekt (žádný markdown, žádný úvod) s poli:
- primaryType: jedna z hodnot ${PRIMARY_DOCUMENT_TYPES.map((t) => `"${t}"`).join(", ")}
- subtype: co nejkonkrétnější produkt/instituce varianta (např. "generali_bel_mondo"), jinak "unknown"
- lifecycleStatus: jedna z hodnot ${DOCUMENT_LIFECYCLE_STATUSES.map((t) => `"${t}"`).join(", ")}
- confidence: číslo 0–1
- reasons: krátké důvody (pole stringů)

Rozhoduj podle nadpisů, institucí, sekcí, klíčových frází, tabulek a kontextových patternů.
Nikdy neoznač offer/proposal jako final_contract bez explicitního důkazu.`;

export function normalizeClassification(raw: Partial<ClassificationResult>): ClassificationResult {
  const primaryType = (raw.primaryType ?? "unsupported_or_unknown") as ContractDocumentType;
  return {
    primaryType,
    subtype: raw.subtype?.trim() || "unknown",
    lifecycleStatus: classifyLifecycleFromPrimary(primaryType, raw.lifecycleStatus),
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0,
    reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
  };
}

/** Exported for unit tests. */
export function parseClassificationResponse(raw: string): ClassificationResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  // Backward compatibility for older prompts/tests.
  const aliasMap: Record<string, ContractDocumentType> = {
    insurance_contract: "life_insurance_contract",
    investment_contract: "investment_service_agreement",
    loan_or_mortgage_contract: "consumer_loan_contract",
    amendment: "generic_financial_document",
    application_or_proposal: "life_insurance_proposal",
    payment_document: "bank_statement",
    terms_and_conditions: "service_agreement",
    unknown: "unsupported_or_unknown",
  };
  const upgraded = {
    ...parsed,
    primaryType:
      typeof parsed.primaryType === "string"
        ? parsed.primaryType
        : typeof parsed.documentType === "string"
          ? parsed.documentType
          : "unsupported_or_unknown",
  };
  if (typeof upgraded.primaryType === "string" && aliasMap[upgraded.primaryType]) {
    upgraded.primaryType = aliasMap[upgraded.primaryType];
  }
  const result = classificationResponseSchema.safeParse(upgraded);
  if (!result.success) {
    return normalizeClassification({
      primaryType: "unsupported_or_unknown",
      confidence: 0,
      reasons: ["Parse error: " + result.error.message],
      subtype: "unknown",
      lifecycleStatus: "unknown",
    });
  }
  return normalizeClassification(result.data);
}

export async function classifyContractDocument(
  fileUrl: string
): Promise<ClassificationResult> {
  const raw = await createResponseWithFile(fileUrl, CLASSIFICATION_PROMPT);
  return parseClassificationResponse(raw);
}
