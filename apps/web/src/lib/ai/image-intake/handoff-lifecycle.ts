/**
 * AI Photo / Image Intake — AI Review handoff lifecycle feedback v1 (Phase 8).
 *
 * After submitToAiReviewQueue() creates a `contractUploadReviews` row, this module
 * provides a safe, non-spamming status lookup that maps AI Review pipeline states
 * to image-intake lifecycle feedback.
 *
 * Design decisions:
 * - Single DB lookup, no polling loop — caller decides when to re-check
 * - Safe degradation: if lookup fails, returns "unavailable" (never throws)
 * - Lane separation: reads status only; does NOT trigger AI Review processing
 * - Maps ContractProcessingStatus → HandoffLifecycleStatus
 * - Returns `suggestRefresh: true` only for transient states (submitted/queued/processing)
 *
 * Cost: Zero model calls. One DB read per explicit caller request.
 */

import "server-only";
import { getContractReviewById } from "@/lib/ai/review-queue-repository";
import { isFeatureEnabled } from "@/lib/admin/feature-flags";
import type { HandoffLifecycleFeedback, HandoffLifecycleStatus } from "./types";

// ---------------------------------------------------------------------------
// ContractProcessingStatus → HandoffLifecycleStatus mapping
// ---------------------------------------------------------------------------

const PROCESSING_STATUS_MAP: Record<string, HandoffLifecycleStatus> = {
  uploaded: "submitted",
  processing: "processing",
  extracted: "done",
  review_required: "done",
  failed: "failed",
  scan_pending_ocr: "queued",
  blocked: "failed",
};

const STATUS_LABELS: Record<HandoffLifecycleStatus, string> = {
  prepared: "Připraveno k odeslání",
  submitted: "Čeká ve frontě",
  queued: "Zařazeno do fronty",
  processing: "Probíhá zpracování",
  done: "Zpracování dokončeno",
  failed: "Zpracování selhalo",
  unavailable: "Stav nelze zjistit",
  unknown: "Neznámý stav",
};

const TRANSIENT_STATUSES = new Set<HandoffLifecycleStatus>([
  "submitted",
  "queued",
  "processing",
]);

function mapProcessingStatus(processingStatus: string | null | undefined): HandoffLifecycleStatus {
  if (!processingStatus) return "unknown";
  return PROCESSING_STATUS_MAP[processingStatus] ?? "unknown";
}

// ---------------------------------------------------------------------------
// Status lookup
// ---------------------------------------------------------------------------

/**
 * Looks up the current lifecycle status of a submitted handoff.
 *
 * Safe to call on any request — single DB read, no side effects, non-throwing.
 * Returns "unavailable" on any error or missing data.
 *
 * @param reviewRowId  The contractUploadReviews row ID from submitToAiReviewQueue
 * @param tenantId     Tenant scoping for DB lookup
 */
export async function getHandoffLifecycleFeedback(
  reviewRowId: string | null | undefined,
  tenantId: string,
): Promise<HandoffLifecycleFeedback> {
  const checkedAt = new Date().toISOString();

  if (!reviewRowId) {
    return {
      status: "unknown",
      reviewRowId: null,
      statusLabel: STATUS_LABELS.unknown,
      processingStageHint: null,
      suggestRefresh: false,
      checkedAt,
    };
  }

  if (!isFeatureEnabled("image_intake_enabled", tenantId)) {
    return {
      status: "unavailable",
      reviewRowId,
      statusLabel: STATUS_LABELS.unavailable,
      processingStageHint: null,
      suggestRefresh: false,
      checkedAt,
    };
  }

  try {
    const row = await getContractReviewById(reviewRowId, tenantId);

    if (!row) {
      return {
        status: "unavailable",
        reviewRowId,
        statusLabel: STATUS_LABELS.unavailable,
        processingStageHint: null,
        suggestRefresh: false,
        checkedAt,
      };
    }

    const status = mapProcessingStatus(row.processingStatus);

    return {
      status,
      reviewRowId,
      statusLabel: STATUS_LABELS[status],
      processingStageHint: row.processingStage ?? null,
      suggestRefresh: TRANSIENT_STATUSES.has(status),
      checkedAt,
    };
  } catch {
    return {
      status: "unavailable",
      reviewRowId,
      statusLabel: STATUS_LABELS.unavailable,
      processingStageHint: null,
      suggestRefresh: false,
      checkedAt,
    };
  }
}

/**
 * Maps a HandoffLifecycleFeedback to a short human-readable preview note.
 * Used in the assistant preview/confirm flow to show status hint.
 */
export function buildHandoffLifecycleNote(feedback: HandoffLifecycleFeedback): string {
  const base = `AI Review: ${feedback.statusLabel}`;
  if (feedback.processingStageHint) {
    return `${base} (${feedback.processingStageHint})`;
  }
  return base;
}

/**
 * Returns a "prepared" feedback stub when a handoff is built but not yet submitted.
 * Used for the pre-submit preview step.
 */
export function buildPreparedHandoffFeedback(): HandoffLifecycleFeedback {
  return {
    status: "prepared",
    reviewRowId: null,
    statusLabel: STATUS_LABELS.prepared,
    processingStageHint: null,
    suggestRefresh: false,
    checkedAt: new Date().toISOString(),
  };
}
