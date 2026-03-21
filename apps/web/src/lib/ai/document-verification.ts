import type {
  DataCompleteness,
  DocumentReviewEnvelope,
  ExtractedField,
  ReviewWarning,
} from "./document-review-types";
import type { DocumentSchemaDefinition } from "./document-schema-registry";

function getField(
  fields: Record<string, ExtractedField>,
  key: string
): ExtractedField | undefined {
  return fields[key] ?? fields[key.replace(/^extractedFields\./, "")];
}

function isSatisfied(field: ExtractedField | undefined): boolean {
  if (!field) return false;
  if (field.status === "not_applicable") return true;
  if (field.status === "explicitly_not_selected") return true;
  if (field.status === "extracted" || field.status === "inferred_low_confidence") {
    return field.value !== null && field.value !== undefined && String(field.value).trim() !== "";
  }
  return false;
}

function hasLowEvidence(field: ExtractedField | undefined): boolean {
  if (!field) return true;
  return typeof field.confidence !== "number" || field.confidence < 0.55 || !field.evidenceSnippet;
}

export type VerificationResult = {
  envelope: DocumentReviewEnvelope;
  warnings: ReviewWarning[];
  reasonsForReview: string[];
  completeness: DataCompleteness;
};

export function runVerificationPass(
  envelope: DocumentReviewEnvelope,
  schemaDefinition: DocumentSchemaDefinition
): VerificationResult {
  const warnings: ReviewWarning[] = [...envelope.reviewWarnings];
  const reasons = new Set<string>();
  const fields = envelope.extractedFields;

  let requiredSatisfied = 0;
  for (const key of schemaDefinition.extractionRules.required) {
    const field = getField(fields, key);
    if (isSatisfied(field)) {
      requiredSatisfied += 1;
      if (hasLowEvidence(field)) {
        warnings.push({
          code: "LOW_EVIDENCE_REQUIRED",
          message: `Pole ${key} má slabou evidenci.`,
          field: key,
          severity: "warning",
        });
        reasons.add("low_evidence_required");
      }
    } else {
      warnings.push({
        code: "MISSING_REQUIRED_FIELD",
        message: `Chybí povinné pole ${key}.`,
        field: key,
        severity: "critical",
      });
      reasons.add("missing_required_data");
      if (!field) {
        fields[key.replace(/^extractedFields\./, "")] = {
          value: undefined,
          status: "missing",
          confidence: 0,
        };
      }
    }
  }

  let optionalExtracted = 0;
  for (const key of schemaDefinition.extractionRules.optional) {
    if (isSatisfied(getField(fields, key))) optionalExtracted += 1;
  }

  let notApplicableCount = 0;
  for (const field of Object.values(fields)) {
    if (field.status === "not_applicable") notApplicableCount += 1;
  }

  // Lifecycle sanity checks
  const lifecycle = envelope.documentClassification.lifecycleStatus;
  const isFinal = lifecycle === "final_contract";
  const isOfferish = lifecycle === "offer" || lifecycle === "proposal" || lifecycle === "comparison";
  if (isOfferish && isFinal) {
    warnings.push({
      code: "LIFECYCLE_CONFLICT",
      message: "Dokument vypadá jako offer/proposal/comparison, ale je označen jako final_contract.",
      severity: "critical",
    });
    reasons.add("proposal_not_final_contract");
  }
  if (envelope.documentMeta.scannedVsDigital === "scanned" && (envelope.documentMeta.overallConfidence ?? 0.6) > 0.9) {
    warnings.push({
      code: "SCAN_CONFIDENCE_SUSPICIOUS",
      message: "Naskenovaný dokument má podezřele vysokou jistotu.",
      severity: "warning",
    });
    reasons.add("low_ocr_quality");
  }

  const completenessScore =
    schemaDefinition.extractionRules.required.length === 0
      ? 1
      : requiredSatisfied / schemaDefinition.extractionRules.required.length;

  const completeness: DataCompleteness = {
    requiredTotal: schemaDefinition.extractionRules.required.length,
    requiredSatisfied,
    optionalExtracted,
    notApplicableCount,
    score: Math.max(0, Math.min(1, completenessScore)),
  };

  envelope.reviewWarnings = warnings;
  envelope.dataCompleteness = completeness;
  return {
    envelope,
    warnings,
    reasonsForReview: [...reasons],
    completeness,
  };
}

