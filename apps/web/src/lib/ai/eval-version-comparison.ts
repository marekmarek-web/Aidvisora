/**
 * Compare two eval runs to detect regressions or improvements.
 */

import type { EvalRunMetrics } from "./eval-types";

export type EvalDelta = {
  metric: string;
  before: number;
  after: number;
  delta: number;
  regression: boolean;
};

export type EvalComparisonResult = {
  pass: boolean;
  deltas: EvalDelta[];
  regressions: string[];
  improvements: string[];
};

const REGRESSION_THRESHOLDS: Record<string, number> = {
  documentClassificationAccuracy: -0.02,
  fieldLevelAccuracy: -0.02,
  paymentInstructionExtractionAccuracy: -0.01,
  contractExtractionCompleteness: -0.03,
  clientMatchingAccuracy: -0.02,
  reviewRate: 0.05,
  falsePositiveApplyRate: 0.03,
};

export function compareEvalRuns(
  baseline: EvalRunMetrics,
  current: EvalRunMetrics,
): EvalComparisonResult {
  const deltas: EvalDelta[] = [];
  const regressions: string[] = [];
  const improvements: string[] = [];

  const metrics = Object.keys(REGRESSION_THRESHOLDS) as Array<keyof typeof REGRESSION_THRESHOLDS>;

  for (const metric of metrics) {
    const before = (baseline as unknown as Record<string, number>)[metric] ?? 0;
    const after = (current as unknown as Record<string, number>)[metric] ?? 0;
    const delta = after - before;
    const threshold = REGRESSION_THRESHOLDS[metric];

    const isIncreasingBad = metric === "reviewRate" || metric === "falsePositiveApplyRate";
    const regression = isIncreasingBad ? delta > threshold : delta < threshold;

    deltas.push({ metric, before, after, delta, regression });

    if (regression) {
      regressions.push(metric);
    } else if (Math.abs(delta) > 0.005) {
      const improved = isIncreasingBad ? delta < 0 : delta > 0;
      if (improved) improvements.push(metric);
    }
  }

  return {
    pass: regressions.length === 0,
    deltas,
    regressions,
    improvements,
  };
}
