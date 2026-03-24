/**
 * Aggregation queries for AI extraction quality metrics.
 * Reads from contract_upload_reviews without exposing raw document content.
 */

import { db } from "db";
import { contractUploadReviews } from "db";
import { sql, eq, and, gte, isNotNull } from "db";

export type QualitySummary = {
  totalDocuments: number;
  successCount: number;
  reviewRequiredCount: number;
  failedCount: number;
  successRate: number;
  reviewRequiredRate: number;
  failedRate: number;
  avgPreprocessDurationMs: number | null;
  avgPipelineDurationMs: number | null;
  byDocumentType: Record<string, { total: number; success: number; failed: number; review: number }>;
  byInputMode: Record<string, { total: number; success: number; failed: number; review: number }>;
  topFailedSteps: Record<string, number>;
  topReasons: Record<string, number>;
};

export type CorrectionSummary = {
  totalCorrectedReviews: number;
  topCorrectedFields: Record<string, number>;
  correctionsByDocumentType: Record<string, number>;
};

export async function getQualitySummary(
  tenantId: string,
  windowDays?: number,
): Promise<QualitySummary> {
  const conditions = [eq(contractUploadReviews.tenantId, tenantId)];
  if (windowDays) {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    conditions.push(gte(contractUploadReviews.createdAt, since));
  }

  const rows = await db
    .select({
      processingStatus: contractUploadReviews.processingStatus,
      detectedDocumentType: contractUploadReviews.detectedDocumentType,
      inputMode: contractUploadReviews.inputMode,
      extractionTrace: contractUploadReviews.extractionTrace,
      reasonsForReview: contractUploadReviews.reasonsForReview,
    })
    .from(contractUploadReviews)
    .where(and(...conditions));

  let totalDocs = 0;
  let successCount = 0;
  let reviewRequiredCount = 0;
  let failedCount = 0;
  let preprocessMs = 0;
  let preprocessCount = 0;
  let pipelineMs = 0;
  let pipelineCount = 0;
  const byDocumentType: QualitySummary["byDocumentType"] = {};
  const byInputMode: QualitySummary["byInputMode"] = {};
  const failedSteps: Record<string, number> = {};
  const reasonCounts: Record<string, number> = {};

  for (const row of rows) {
    totalDocs++;
    const status = row.processingStatus;
    if (status === "extracted") successCount++;
    else if (status === "review_required") reviewRequiredCount++;
    else if (status === "failed") failedCount++;

    const dt = (row.detectedDocumentType as string) ?? "unknown";
    const dtEntry = byDocumentType[dt] ?? { total: 0, success: 0, failed: 0, review: 0 };
    dtEntry.total++;
    if (status === "extracted") dtEntry.success++;
    else if (status === "failed") dtEntry.failed++;
    else if (status === "review_required") dtEntry.review++;
    byDocumentType[dt] = dtEntry;

    const im = (row.inputMode as string) ?? "unknown";
    const imEntry = byInputMode[im] ?? { total: 0, success: 0, failed: 0, review: 0 };
    imEntry.total++;
    if (status === "extracted") imEntry.success++;
    else if (status === "failed") imEntry.failed++;
    else if (status === "review_required") imEntry.review++;
    byInputMode[im] = imEntry;

    const trace = row.extractionTrace as Record<string, unknown> | null;
    if (trace) {
      if (typeof trace.preprocessDurationMs === "number") {
        preprocessMs += trace.preprocessDurationMs;
        preprocessCount++;
      }
      if (typeof trace.pipelineDurationMs === "number") {
        pipelineMs += trace.pipelineDurationMs;
        pipelineCount++;
      }
      if (typeof trace.failedStep === "string" && trace.failedStep) {
        failedSteps[trace.failedStep] = (failedSteps[trace.failedStep] ?? 0) + 1;
      }
    }

    const reasons = row.reasonsForReview as string[] | null;
    if (reasons) {
      for (const r of reasons) {
        reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
      }
    }
  }

  return {
    totalDocuments: totalDocs,
    successCount,
    reviewRequiredCount,
    failedCount,
    successRate: totalDocs > 0 ? successCount / totalDocs : 0,
    reviewRequiredRate: totalDocs > 0 ? reviewRequiredCount / totalDocs : 0,
    failedRate: totalDocs > 0 ? failedCount / totalDocs : 0,
    avgPreprocessDurationMs: preprocessCount > 0 ? preprocessMs / preprocessCount : null,
    avgPipelineDurationMs: pipelineCount > 0 ? pipelineMs / pipelineCount : null,
    byDocumentType,
    byInputMode,
    topFailedSteps: failedSteps,
    topReasons: reasonCounts,
  };
}

export async function getCorrectionSummary(
  tenantId: string,
  windowDays?: number,
): Promise<CorrectionSummary> {
  const conditions = [
    eq(contractUploadReviews.tenantId, tenantId),
    isNotNull(contractUploadReviews.originalExtractedPayload),
  ];
  if (windowDays) {
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    conditions.push(gte(contractUploadReviews.createdAt, since));
  }

  const rows = await db
    .select({
      correctedFields: contractUploadReviews.correctedFields,
      detectedDocumentType: contractUploadReviews.detectedDocumentType,
    })
    .from(contractUploadReviews)
    .where(and(...conditions));

  const fieldCounts: Record<string, number> = {};
  const byDocType: Record<string, number> = {};

  for (const row of rows) {
    const fields = row.correctedFields as string[] | null;
    if (fields) {
      for (const f of fields) {
        fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;
      }
    }
    const dt = (row.detectedDocumentType as string) ?? "unknown";
    byDocType[dt] = (byDocType[dt] ?? 0) + 1;
  }

  return {
    totalCorrectedReviews: rows.length,
    topCorrectedFields: fieldCounts,
    correctionsByDocumentType: byDocType,
  };
}
