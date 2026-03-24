/**
 * Correction analytics: builds structured records from human corrections,
 * aggregates them for ranking and diagnostics.
 */

import type { ExtractionComparisonResult } from "./eval-types";
import type { ContractReviewRow } from "./review-queue-repository";
import { compareExtractedToCorrected } from "./eval-comparison";

export type CorrectionRecord = {
  reviewId: string;
  tenantId: string;
  documentType: string | null;
  normalizedClassification: string | null;
  inputMode: string | null;
  extractionRoute: string | null;
  institutionName: string | null;
  correctedFields: string[];
  correctedBy: string | null;
  correctedAt: Date | null;
  correctionReason: string | null;
  comparison: ExtractionComparisonResult;
  pipelineVersion: string | null;
};

export type FieldCorrectionRank = {
  fieldPath: string;
  count: number;
  addedCount: number;
  removedCount: number;
  changedCount: number;
};

export type CorrectionAnalyticsSummary = {
  totalCorrections: number;
  topCorrectedFields: FieldCorrectionRank[];
  correctionsByDocumentType: Record<string, number>;
  correctionsByInstitution: Record<string, number>;
  correctionsByInputMode: Record<string, number>;
  correctionsByRoute: Record<string, number>;
  averageCorrectedFieldsPerReview: number;
};

export function buildCorrectionRecord(row: ContractReviewRow): CorrectionRecord | null {
  const original = row.originalExtractedPayload;
  const corrected = row.correctedPayload ?? row.extractedPayload;

  if (!original || !corrected) return null;
  if (typeof original !== "object" || typeof corrected !== "object") return null;

  const comparison = compareExtractedToCorrected(
    original as Record<string, unknown>,
    corrected as Record<string, unknown>,
  );

  if (comparison.changedFields.length === 0) return null;

  const trace = row.extractionTrace;
  const payload = row.extractedPayload as Record<string, unknown> | null;
  const institutionName =
    (payload?.institutionName as string) ??
    (payload?.institution as string) ??
    null;

  return {
    reviewId: row.id,
    tenantId: row.tenantId,
    documentType: row.detectedDocumentType,
    normalizedClassification: trace?.normalizedPipelineClassification ?? null,
    inputMode: row.inputMode,
    extractionRoute: trace?.extractionRoute ?? null,
    institutionName,
    correctedFields: row.correctedFields ?? comparison.changedFields,
    correctedBy: row.correctedBy,
    correctedAt: row.correctedAt,
    correctionReason: row.correctionReason,
    comparison,
    pipelineVersion: trace?.pipelineVersion ?? null,
  };
}

export function aggregateCorrectionAnalytics(
  records: CorrectionRecord[],
): CorrectionAnalyticsSummary {
  const fieldCounts = new Map<string, { added: number; removed: number; changed: number }>();
  const byDocType: Record<string, number> = {};
  const byInstitution: Record<string, number> = {};
  const byInputMode: Record<string, number> = {};
  const byRoute: Record<string, number> = {};
  let totalFields = 0;

  for (const rec of records) {
    const dt = rec.documentType ?? "unknown";
    byDocType[dt] = (byDocType[dt] ?? 0) + 1;

    if (rec.institutionName) {
      byInstitution[rec.institutionName] = (byInstitution[rec.institutionName] ?? 0) + 1;
    }

    const im = rec.inputMode ?? "unknown";
    byInputMode[im] = (byInputMode[im] ?? 0) + 1;

    const route = rec.extractionRoute ?? "unknown";
    byRoute[route] = (byRoute[route] ?? 0) + 1;

    totalFields += rec.comparison.changedFields.length;

    for (const f of rec.comparison.changedFields) {
      const entry = fieldCounts.get(f) ?? { added: 0, removed: 0, changed: 0 };
      if (rec.comparison.addedInCorrection.includes(f)) entry.added++;
      else if (rec.comparison.removedInCorrection.includes(f)) entry.removed++;
      else entry.changed++;
      fieldCounts.set(f, entry);
    }
  }

  const topCorrectedFields: FieldCorrectionRank[] = [...fieldCounts.entries()]
    .map(([fieldPath, c]) => ({
      fieldPath,
      count: c.added + c.removed + c.changed,
      addedCount: c.added,
      removedCount: c.removed,
      changedCount: c.changed,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCorrections: records.length,
    topCorrectedFields,
    correctionsByDocumentType: byDocType,
    correctionsByInstitution: byInstitution,
    correctionsByInputMode: byInputMode,
    correctionsByRoute: byRoute,
    averageCorrectedFieldsPerReview:
      records.length > 0 ? totalFields / records.length : 0,
  };
}
