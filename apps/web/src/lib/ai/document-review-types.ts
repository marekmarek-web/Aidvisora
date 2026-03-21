import { z } from "zod";

export const PRIMARY_DOCUMENT_TYPES = [
  "life_insurance_contract",
  "life_insurance_proposal",
  "consumer_loan_contract",
  "consumer_loan_with_payment_protection",
  "mortgage_document",
  "income_confirmation",
  "bank_statement",
  "investment_service_agreement",
  "investment_subscription_document",
  "liability_insurance_offer",
  "insurance_comparison",
  "service_agreement",
  "generic_financial_document",
  "unsupported_or_unknown",
] as const;

export type PrimaryDocumentType = (typeof PRIMARY_DOCUMENT_TYPES)[number];

export const DOCUMENT_LIFECYCLE_STATUSES = [
  "final_contract",
  "proposal",
  "offer",
  "confirmation",
  "statement",
  "annex",
  "comparison",
  "onboarding_form",
  "unknown",
] as const;

export type DocumentLifecycleStatus = (typeof DOCUMENT_LIFECYCLE_STATUSES)[number];

export const EXTRACTION_FIELD_STATUSES = [
  "extracted",
  "inferred_low_confidence",
  "missing",
  "not_found",
  "not_applicable",
  "explicitly_not_selected",
] as const;

export type ExtractionFieldStatus = (typeof EXTRACTION_FIELD_STATUSES)[number];

export const SENSITIVITY_PROFILES = [
  "standard_personal_data",
  "financial_data",
  "health_data",
  "special_category_data",
  "high_sensitivity_scan",
] as const;

export type SensitivityProfile = (typeof SENSITIVITY_PROFILES)[number];

export const sensitivityProfileSchema = z.enum(SENSITIVITY_PROFILES);
export const extractionFieldStatusSchema = z.enum(EXTRACTION_FIELD_STATUSES);

export const extractedFieldSchema = z.object({
  value: z.unknown().optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourcePage: z.number().int().positive().optional(),
  evidenceSnippet: z.string().max(400).optional(),
  status: extractionFieldStatusSchema,
  sensitive: z.boolean().optional(),
});

export type ExtractedField = z.infer<typeof extractedFieldSchema>;

export const documentClassificationSchema = z.object({
  primaryType: z.enum(PRIMARY_DOCUMENT_TYPES),
  subtype: z.string().min(1).max(120).optional(),
  lifecycleStatus: z.enum(DOCUMENT_LIFECYCLE_STATUSES),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([]),
});

export type DocumentClassification = z.infer<typeof documentClassificationSchema>;

export const fieldEvidenceSchema = z.object({
  fieldKey: z.string().min(1),
  value: z.unknown().optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourcePage: z.number().int().positive().optional(),
  evidenceSnippet: z.string().max(400).optional(),
  status: extractionFieldStatusSchema,
});

export type FieldEvidence = z.infer<typeof fieldEvidenceSchema>;

export const candidateMatchSchema = z.object({
  entityId: z.string(),
  score: z.number().min(0).max(1),
  reason: z.string(),
  ambiguous: z.boolean().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export type CandidateMatch = z.infer<typeof candidateMatchSchema>;

export const candidateMatchesEnvelopeSchema = z.object({
  matchedClients: z.array(candidateMatchSchema).default([]),
  matchedHouseholds: z.array(candidateMatchSchema).default([]),
  matchedDeals: z.array(candidateMatchSchema).default([]),
  score: z.number().min(0).max(1).default(0),
  reason: z.string().default("no_match"),
  ambiguityFlags: z.array(z.string()).default([]),
});

export type CandidateMatchesEnvelope = z.infer<typeof candidateMatchesEnvelopeSchema>;

export const reviewWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
});

export type ReviewWarning = z.infer<typeof reviewWarningSchema>;

export const suggestedActionSchema = z.object({
  type: z.string(),
  label: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type SuggestedAction = z.infer<typeof suggestedActionSchema>;

export const dataCompletenessSchema = z.object({
  requiredTotal: z.number().int().nonnegative(),
  requiredSatisfied: z.number().int().nonnegative(),
  optionalExtracted: z.number().int().nonnegative(),
  conditionalSatisfied: z.number().int().nonnegative().optional(),
  notApplicableCount: z.number().int().nonnegative().default(0),
  score: z.number().min(0).max(1),
});

export type DataCompleteness = z.infer<typeof dataCompletenessSchema>;

export const documentReviewEnvelopeSchema = z.object({
  documentClassification: documentClassificationSchema,
  documentMeta: z.object({
    fileName: z.string().optional(),
    pageCount: z.number().int().positive().optional(),
    issuer: z.string().optional(),
    documentDate: z.string().optional(),
    language: z.string().optional(),
    scannedVsDigital: z.enum(["scanned", "digital", "unknown"]).default("unknown"),
    overallConfidence: z.number().min(0).max(1).optional(),
  }),
  parties: z.record(z.string(), z.unknown()).default({}),
  productsOrObligations: z.array(z.record(z.string(), z.unknown())).default([]),
  financialTerms: z.record(z.string(), z.unknown()).default({}),
  serviceTerms: z.record(z.string(), z.unknown()).default({}),
  extractedFields: z.record(z.string(), extractedFieldSchema).default({}),
  evidence: z.array(fieldEvidenceSchema).default([]),
  candidateMatches: candidateMatchesEnvelopeSchema.default({
    matchedClients: [],
    matchedHouseholds: [],
    matchedDeals: [],
    score: 0,
    reason: "no_match",
    ambiguityFlags: [],
  }),
  reviewWarnings: z.array(reviewWarningSchema).default([]),
  suggestedActions: z.array(suggestedActionSchema).default([]),
  dataCompleteness: dataCompletenessSchema.optional(),
  sensitivityProfile: sensitivityProfileSchema.default("standard_personal_data"),
  debug: z.record(z.string(), z.unknown()).optional(),
});

export type DocumentReviewEnvelope = z.infer<typeof documentReviewEnvelopeSchema>;

