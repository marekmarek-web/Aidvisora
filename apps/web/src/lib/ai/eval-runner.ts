/**
 * Eval runner: compares expected golden results against extracted payloads.
 * Used offline (test / admin endpoint) — does not invoke live pipeline.
 */

import type {
  EvalDataset,
  EvalDatasetEntry,
  EvalDocumentResult,
  EvalFieldResult,
  EvalRunMetrics,
} from "./eval-types";
import { computeFieldAccuracy, computeCompleteness, aggregateEvalMetrics } from "./eval-types";

/**
 * Compare a single extracted payload against a golden entry.
 * `extracted` is the flat key-value map from the review's `extractedPayload`.
 */
export function compareDocumentResult(
  entry: EvalDatasetEntry,
  extracted: Record<string, unknown>,
  meta?: {
    classifiedType?: string;
    lifecycleStatus?: string;
    reviewDecision?: "extracted" | "review_required" | "failed";
    processingTimeMs?: number;
    containsPaymentInstructions?: boolean;
    clientMatchName?: string;
  },
): EvalDocumentResult {
  const classificationCorrect =
    (meta?.classifiedType ?? "") === entry.expectedClassification.primaryType;

  const lifecycleCorrect =
    (meta?.lifecycleStatus ?? "") === entry.expectedClassification.lifecycleStatus;

  const paymentCorrect =
    entry.expectedClassification.containsPaymentInstructions
      ? meta?.containsPaymentInstructions === true
      : true;

  const clientMatchCorrect = entry.expectedClientMatch
    ? (meta?.clientMatchName ?? "").toLowerCase().includes(
        entry.expectedClientMatch.clientName.toLowerCase(),
      )
    : true;

  const fieldResults: EvalFieldResult[] = [];
  for (const [key, spec] of Object.entries(entry.expectedFields)) {
    const extractedVal = extracted[key];
    const correct = extractedVal != null && String(extractedVal) === String(spec.value);
    fieldResults.push({
      fieldKey: key,
      expected: spec.value,
      extracted: extractedVal ?? null,
      correct,
      confidence: 0,
    });
  }

  const extractedAsStatusMap: Record<string, { value?: unknown; status?: string }> = {};
  for (const [k, v] of Object.entries(extracted)) {
    extractedAsStatusMap[k] = { value: v, status: v != null ? "extracted" : "missing" };
  }

  return {
    entryId: entry.id,
    documentName: entry.documentName,
    classificationCorrect,
    classificationConfidence: 0,
    lifecycleCorrect,
    contentFlagsCorrect: paymentCorrect,
    fieldResults,
    fieldAccuracy: computeFieldAccuracy(fieldResults),
    completeness: computeCompleteness(entry.expectedFields, extractedAsStatusMap),
    paymentExtractionCorrect: paymentCorrect,
    clientMatchCorrect,
    reviewDecision: meta?.reviewDecision ?? "extracted",
    processingTimeMs: meta?.processingTimeMs ?? 0,
  };
}

/**
 * Run eval batch from a dataset against a set of pre-extracted payloads.
 * `payloads` maps entry ID -> extracted payload.
 */
export function runEvalBatch(
  dataset: EvalDataset,
  payloads: Map<string, Record<string, unknown>>,
  metaMap?: Map<string, Parameters<typeof compareDocumentResult>[2]>,
): EvalRunMetrics {
  const results: EvalDocumentResult[] = [];

  for (const entry of dataset.entries) {
    const extracted = payloads.get(entry.id);
    if (!extracted) continue;
    const meta = metaMap?.get(entry.id);
    results.push(compareDocumentResult(entry, extracted, meta));
  }

  const aggregated = aggregateEvalMetrics(results);

  return {
    runId: `eval-${Date.now()}`,
    datasetVersion: dataset.version,
    runAt: new Date().toISOString(),
    ...aggregated,
    documentResults: results,
  };
}
