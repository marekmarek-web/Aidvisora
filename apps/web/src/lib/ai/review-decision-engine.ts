/**
 * Review decision engine for the contract pipeline.
 * Decides extracted | review_required | failed from confidence, validation, and input mode.
 */

import type { ContractProcessingStatus } from "db";
import type { ValidationResult } from "./extraction-validation";
import type { InputMode } from "./input-mode-detection";

export type ReviewDecisionParams = {
  /** Classification confidence 0-1. */
  classificationConfidence: number;
  /** Extraction overall confidence 0-1. */
  extractionConfidence: number;
  /** Validation result (legacy contract validation). */
  validation: ValidationResult;
  /** Envelope-level validation (proposal confusion, payment completeness, etc.). */
  envelopeValidation?: ValidationResult;
  /** Input mode (scan alone does not imply failed). */
  inputMode: InputMode;
  /** True if extraction step failed (no valid JSON, API error). */
  extractionFailed: boolean;
  /** Optional: minimum confidence to allow "extracted" without review. */
  confidenceThreshold?: number;
};

export type ReviewDecisionResult = {
  status: ContractProcessingStatus;
  reason: string | null;
};

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Decide processing status: extracted | review_required | failed.
 * - failed: only when extraction truly failed (no valid data, API error).
 * - review_required: low confidence, validation warnings, or scan with uncertain extraction.
 * - extracted: confidence above threshold and no blocking validation issues.
 */
export function decideReviewStatus(params: ReviewDecisionParams): ContractProcessingStatus {
  return decideReviewStatusWithReason(params).status;
}

export function decideReviewStatusWithReason(params: ReviewDecisionParams): ReviewDecisionResult {
  const {
    classificationConfidence,
    extractionConfidence,
    validation,
    envelopeValidation,
    inputMode,
    extractionFailed,
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
  } = params;

  if (extractionFailed) {
    return { status: "failed", reason: "extraction_failed" };
  }

  const hasBlockingValidation = !validation.valid;
  const hasWarnings = validation.warnings.length > 0;
  const lowClassification = classificationConfidence < confidenceThreshold;
  const lowExtraction = extractionConfidence < confidenceThreshold;
  const isScanOrImage = inputMode === "scanned_pdf" || inputMode === "image_document" || inputMode === "mixed_pdf";

  if (envelopeValidation && !envelopeValidation.valid) {
    return { status: "review_required", reason: "envelope_validation_blocking" };
  }

  if (envelopeValidation && envelopeValidation.warnings.length > 0) {
    const hasCritical = envelopeValidation.warnings.some((w) =>
      ["PROPOSAL_MARKED_AS_CONTRACT", "PAYMENT_INSTRUCTION_AS_CONTRACT"].includes(w.code),
    );
    if (hasCritical) {
      return { status: "review_required", reason: "envelope_classification_conflict" };
    }
  }

  if (hasBlockingValidation) {
    return { status: "review_required", reason: "validation_blocking" };
  }

  if (lowClassification) {
    return { status: "review_required", reason: "low_classification_confidence" };
  }

  if (lowExtraction) {
    return { status: "review_required", reason: "low_extraction_confidence" };
  }

  if (hasWarnings) {
    return { status: "review_required", reason: "validation_warnings" };
  }

  if (envelopeValidation && envelopeValidation.warnings.length > 0) {
    return { status: "review_required", reason: "envelope_warnings" };
  }

  if (isScanOrImage && lowExtraction) {
    return { status: "review_required", reason: "scan_low_extraction" };
  }

  return { status: "extracted", reason: null };
}
