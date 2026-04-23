/**
 * Vision-fallback gate (Wave 1.3 of Premium Scan Closeout).
 *
 * Pure, side-effect-free module. Centralizes the decision matrix that today is
 * scattered across `ai-review-pipeline-v2.ts` (env flag checks, scan-vision
 * fallback toggle, full-vision activation) and would otherwise grow even more
 * fragmented once vision-primary (Wave 3) + AML/FATCA extract (Wave 4) land.
 *
 * ## Modes
 *
 * - **Permissive (default, Wave 1.3):** `enforceMode=false`. The decision object
 *   still evaluates publish-block heuristics and reports `publishBlockReasons`,
 *   but `hardBlockPublish` is ALWAYS `false` so pipeline/apply code never halts
 *   on gate output. This is how we collect 24-48h of production metrics before
 *   Wave 5 hardens the gate.
 *
 * - **Enforcing (Wave 5):** `enforceMode=true`. `hardBlockPublish` actually
 *   reflects the heuristic result. Wave 5 wires it into `applyContractReview`
 *   to downgrade `processingStatus` to `review_required` for recovered critical
 *   fields. Callers in Wave 1.3 MUST pass `enforceMode: false`.
 *
 * ## Non-goals
 *
 * - Does not call Sentry / PostHog. Telemetry belongs to the caller
 *   (`breadcrumbVisionFallbackGateDecision` in `observability/scan-sentry.ts`).
 * - Does not mutate the envelope.
 * - Does not decide whether the text path or the file-multimodal path ran.
 *   `runRescue` / `runFullVision` mirror today's two boolean checks; the gate
 *   is the single source of truth going forward, but Wave 1.3 wires it in
 *   breadcrumb-only so the old checks keep their effect.
 */

import type { DocumentReviewEnvelope, EvidenceTier } from "./document-review-types";

/** Fields whose recovery from vision triggers a publish block in enforce mode. */
export const CRITICAL_PUBLISH_FIELDS: readonly string[] = [
  "iban",
  "accountNumber",
  "personalId",
  "policyAmount",
  "contractNumber",
];

/** Evidence tiers that indicate "recovered from vision fallback". */
export const VISION_RECOVERED_TIERS: ReadonlySet<EvidenceTier> = new Set([
  "recovered_from_image",
  "recovered_from_full_vision",
]);

/** Confidence floor below which a scan-vision-fallback result is considered "low confidence". */
export const LOW_CONFIDENCE_SCAN_THRESHOLD = 0.6;

/** Upper bound of recovered-from-vision ratio before the gate flags "overall recovery risk". */
export const RECOVERED_RATIO_FLAG_THRESHOLD = 0.5;

export type VisionFallbackGateInput = {
  /** `true` when the pipeline activated the scan→vision fallback branch. */
  scanVisionFallbackActivated: boolean;
  /** Resolved value of `AI_REVIEW_PAGE_IMAGE_FALLBACK !== "false"` (today's env flag). */
  pageImageFallbackEnabled: boolean;
  /** `true` when the uploaded file is a PDF we can rasterize for vision. */
  hasPdfFileForVisionFallback: boolean;
  /** Number of pages in the source document (or null if unknown). */
  pageCount: number | null;
  /** The post-extraction envelope. The gate READS from it; it never mutates. */
  envelope: Pick<DocumentReviewEnvelope, "extractedFields">;
  /** Field keys rescued by `runPageImageFallbackForMissingRequired`. */
  recoveredFieldKeys: string[];
  /** Field keys merged by `runFullDocumentVisionExtraction`. */
  fullVisionMergedFieldKeys: string[];
  /** Overall extraction confidence from the envelope (null if not available). */
  overallConfidence: number | null;
  /** Optional tenant id — the gate does not use it today, but it is surfaced on the decision for telemetry tagging. */
  tenantId?: string;
  /**
   * When `true`, `hardBlockPublish` reflects the heuristic. Wave 1.3 ALWAYS
   * passes `false`. Reserved for Wave 5.
   */
  enforceMode?: boolean;
};

export type VisionFallbackGateDecision = {
  /** Should the pipeline run the per-field rescue pass? Mirrors today's condition. */
  runRescue: boolean;
  /** Should the pipeline run the full-document vision pass? Mirrors today's condition. */
  runFullVision: boolean;
  /** Reasons for the rescue / full-vision decisions. */
  reasons: string[];
  /** Actually blocks publish. In permissive mode ALWAYS `false`. */
  hardBlockPublish: boolean;
  /** Heuristic reasons that WOULD block publish in enforce mode. Populated in both modes. */
  publishBlockReasons: string[];
  /** Ratio of fields whose value landed in a vision-recovered tier. Range 0..1. */
  recoveredRatio: number;
  /** Subset of `CRITICAL_PUBLISH_FIELDS` whose current evidenceTier is vision-recovered. */
  criticalFieldsFromVision: string[];
  /** Mirrored from input for telemetry tagging. */
  tenantId?: string;
};

function computeRecoveredStats(
  envelope: Pick<DocumentReviewEnvelope, "extractedFields">
): { totalWithValue: number; recovered: number; criticalFromVision: string[] } {
  const fields = envelope.extractedFields ?? {};
  let totalWithValue = 0;
  let recovered = 0;
  const criticalFromVision: string[] = [];

  for (const [key, field] of Object.entries(fields)) {
    if (!field) continue;
    const value = field.value;
    const hasValue =
      value !== null &&
      value !== undefined &&
      !(typeof value === "string" && value.trim() === "");
    if (!hasValue) continue;
    totalWithValue += 1;
    const tier = field.evidenceTier as EvidenceTier | undefined;
    if (tier && VISION_RECOVERED_TIERS.has(tier)) {
      recovered += 1;
      if (CRITICAL_PUBLISH_FIELDS.includes(key)) {
        criticalFromVision.push(key);
      }
    }
  }

  return { totalWithValue, recovered, criticalFromVision };
}

/**
 * Pure, deterministic gate evaluator. Safe to call multiple times with the same
 * inputs and expect the same output.
 */
export function evaluateVisionFallbackGate(
  input: VisionFallbackGateInput
): VisionFallbackGateDecision {
  const reasons: string[] = [];
  const publishBlockReasons: string[] = [];

  // ── 1. Rescue decision ────────────────────────────────────────────────────
  // Mirrors today's condition in ai-review-pipeline-v2.ts L1917: run when the
  // env flag is on AND we actually have a PDF the rasterizer can consume.
  let runRescue = false;
  if (!input.pageImageFallbackEnabled) {
    reasons.push("rescue_disabled_env_flag");
  } else if (!input.hasPdfFileForVisionFallback) {
    reasons.push("rescue_skipped_no_pdf_file");
  } else {
    runRescue = true;
    reasons.push("rescue_enabled");
  }

  // ── 2. Full-vision decision ───────────────────────────────────────────────
  // Mirrors today's condition at L1969: full vision only when the scan-vision
  // fallback branch was taken AND rescue already ran. Page-count cap matches
  // the DEFAULT_FULL_VISION_MAX_PAGES intent (<=6) that the full-vision module
  // enforces internally, but we surface the reason here so telemetry can spot
  // cost-heavy calls.
  let runFullVision = false;
  if (!runRescue) {
    reasons.push("full_vision_skipped_rescue_not_run");
  } else if (!input.scanVisionFallbackActivated) {
    reasons.push("full_vision_skipped_not_scan_branch");
  } else {
    runFullVision = true;
    reasons.push("full_vision_enabled_scan_branch");
    if (typeof input.pageCount === "number" && input.pageCount > 6) {
      reasons.push("full_vision_page_count_over_cap");
    }
  }

  // ── 3. Recovery accounting ────────────────────────────────────────────────
  const stats = computeRecoveredStats(input.envelope);
  const recoveredRatio =
    stats.totalWithValue > 0 ? stats.recovered / stats.totalWithValue : 0;

  // ── 4. Publish-block heuristics ───────────────────────────────────────────
  // Evaluated in BOTH modes so telemetry captures them even permissively.
  if (stats.criticalFromVision.length > 0) {
    publishBlockReasons.push("critical_field_recovered_from_image");
  }
  if (recoveredRatio > RECOVERED_RATIO_FLAG_THRESHOLD) {
    publishBlockReasons.push("recovered_ratio_above_threshold");
  }
  if (
    input.scanVisionFallbackActivated &&
    typeof input.overallConfidence === "number" &&
    input.overallConfidence < LOW_CONFIDENCE_SCAN_THRESHOLD
  ) {
    publishBlockReasons.push("low_confidence_scan");
  }

  // ── 5. Enforce gate ──────────────────────────────────────────────────────
  // Permissive (default): hardBlockPublish is never true, no matter the
  // heuristic outcome. Wave 1.3 callers MUST pass enforceMode: false.
  const enforceMode = input.enforceMode === true;
  const hardBlockPublish = enforceMode && publishBlockReasons.length > 0;

  return {
    runRescue,
    runFullVision,
    reasons,
    hardBlockPublish,
    publishBlockReasons,
    recoveredRatio,
    criticalFieldsFromVision: stats.criticalFromVision,
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  };
}

export function __forTests() {
  return {
    CRITICAL_PUBLISH_FIELDS,
    VISION_RECOVERED_TIERS,
    LOW_CONFIDENCE_SCAN_THRESHOLD,
    RECOVERED_RATIO_FLAG_THRESHOLD,
    computeRecoveredStats,
  };
}
