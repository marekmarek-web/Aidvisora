/**
 * Wave 5 — pure helper: publish-block decision based on the vision-fallback
 * gate decision that the pipeline (Wave 1.3) writes to
 * `extractionTrace.visionFallbackGate`.
 *
 * Separated from `apply-contract-review.ts` so it can be unit tested without
 * the full DB / transaction stack. The flag
 * `AI_REVIEW_VISION_FALLBACK_GATE_ENFORCE=true` activates the block — default
 * OFF means we only emit a Sentry signal (`capturePublishGuardFailure`).
 */

export type GatePublishCheckInput = {
  /** The `extractionTrace` JSON blob from the review row. Shape is loose. */
  extractionTrace?: Record<string, unknown> | null;
  /** Resolved `AI_REVIEW_VISION_FALLBACK_GATE_ENFORCE === "true"`. */
  enforced: boolean;
};

export type GatePublishCheckResult = {
  /**
   * When populated, the caller should call `capturePublishGuardFailure` with
   * this reason string. Populated regardless of `enforced` so the permissive
   * mode still leaves breadcrumbs.
   */
  signal: string | null;
  /** Final block decision. Only `true` when `enforced && signal`. */
  blocked: boolean;
  /** Advisor-facing error message when `blocked`. Empty string otherwise. */
  error: string;
};

type GateDecisionShape = {
  hardBlockPublish?: boolean;
  publishBlockReasons?: string[];
  criticalFieldsFromVision?: string[];
};

export function evaluateVisionGatePublishBlock(
  input: GatePublishCheckInput
): GatePublishCheckResult {
  const gate = input.extractionTrace?.visionFallbackGate as GateDecisionShape | undefined;
  if (!gate) {
    return { signal: null, blocked: false, error: "" };
  }
  const reasons = gate.publishBlockReasons ?? [];
  const critical = gate.criticalFieldsFromVision ?? [];
  const shouldSignal =
    gate.hardBlockPublish === true ||
    reasons.includes("critical_field_recovered_from_image");
  if (!shouldSignal) {
    return { signal: null, blocked: false, error: "" };
  }
  const signal =
    `vision-fallback gate publish-block signal: criticalFields=[${critical.join(",")}] ` +
    `reasons=[${reasons.join(",")}] enforced=${input.enforced}`;
  if (!input.enforced) {
    return { signal, blocked: false, error: "" };
  }
  const blockedField = critical[0] ?? "kritické pole";
  return {
    signal,
    blocked: true,
    error: `Publish guard: ${blockedField} bylo obnoveno z obrazu skenu. Potvrďte hodnotu ručně v AI Review a aplikuj znovu.`,
  };
}
