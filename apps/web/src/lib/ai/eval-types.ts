/**
 * Eval foundation for contract extraction.
 * Types and interfaces for expected structure, comparison, and human corrections.
 */

import type { ExtractedContractByType } from "./extraction-schemas-by-type";

/** Expected extraction structure (e.g. for eval: what we expect from a document). */
export type ExpectedExtractionStructure = ExtractedContractByType;

/** Single correction record: original vs corrected payload. */
export type ContractCorrectionRecord = {
  reviewId: string;
  originalExtractedPayload: ExtractedContractByType | Record<string, unknown>;
  correctedPayload: ExtractedContractByType | Record<string, unknown>;
  correctedFields: string[];
  correctionReason?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
};

/** Result of comparing extracted to corrected data (for eval and tuning). */
export type ExtractionComparisonResult = {
  changedFields: string[];
  delta: Record<string, { from: unknown; to: unknown }>;
  /** Fields that were added in correction (not present in extracted). */
  addedInCorrection: string[];
  /** Fields that were removed or set to empty in correction. */
  removedInCorrection: string[];
};
