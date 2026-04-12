/**
 * Generic field-level merge policy (F2 Slice D).
 *
 * Defines how incoming (AI-extracted) field values are reconciled against
 * existing CRM field values. This is the single source-of-truth for merge
 * decisions — it must be used by F3 apply orchestration, F7 pending-confirm,
 * and any other layer that writes contact or contract data from an envelope.
 *
 * Rules (from F2 plan §5.2):
 * 1. Strong-ID exact match → same entity (caller responsibility; not here)
 * 2. Empty existing + new value → auto-fill
 * 3. Non-empty existing + different new value → pending/conflict (no blind overwrite)
 * 4. Manual source (`source_kind = "manual"`) → never auto-overwrite
 * 5. Same value (normalised) → no-op (identity)
 *
 * Generic by design: no field names, vendor names, or document-type hacks.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Mirrors `contactSourceKinds` from packages/db/src/schema/contacts.ts.
 * Kept in sync manually; do not add values here without adding them to the DB schema.
 */
export type ContactSourceKind = "manual" | "document" | "ai_review" | "import";

/** Why the merge engine reached a particular decision. */
export type MergeResolutionReason =
  | "identity"          // incoming === existing (normalised) — no change needed
  | "auto_fill"         // existing was empty; incoming fills it automatically
  | "manual_protected"  // existing was set manually; will not be auto-overwritten
  | "conflict"          // both non-empty and different; requires human resolution
  | "incoming_empty";   // incoming has no value; existing is kept as-is

/** The outcome of a single field merge evaluation. */
export type MergeDecisionAction =
  | "keep_existing"     // do not change the stored value
  | "apply_incoming"    // overwrite stored value with incoming value
  | "flag_pending";     // store incoming as pending_confirm; human must resolve

export interface MergeDecision {
  action: MergeDecisionAction;
  reason: MergeResolutionReason;
  /** The value that should be written (for `apply_incoming`) or staged (for `flag_pending`). */
  resolvedValue: string | null;
  /** True when the field should be surfaced to the advisor for review. */
  requiresAdvisorReview: boolean;
}

// ─── Normalisation helper ─────────────────────────────────────────────────────

function normalise(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v).trim().toLowerCase().replace(/\s+/g, " ");
}

function isEmpty(v: string | null | undefined): boolean {
  const s = normalise(v);
  return !s || s === "—" || s === "null" || s === "n/a";
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Evaluates a merge decision for a single field.
 *
 * @param existing         Current value in CRM (string, null, or undefined).
 * @param incoming         Value extracted from document / AI envelope.
 * @param existingSourceKind  How the existing value was set. Defaults to `"manual"` for safety.
 * @returns MergeDecision describing what should happen.
 */
export function resolveFieldMerge(
  existing: string | null | undefined,
  incoming: string | null | undefined,
  existingSourceKind: ContactSourceKind = "manual"
): MergeDecision {
  const existingEmpty = isEmpty(existing);
  const incomingEmpty = isEmpty(incoming);

  // Case 1: incoming has no meaningful value — keep existing regardless.
  if (incomingEmpty) {
    return {
      action: "keep_existing",
      reason: "incoming_empty",
      resolvedValue: existing ?? null,
      requiresAdvisorReview: false,
    };
  }

  // Case 2: existing is empty — safe auto-fill.
  if (existingEmpty) {
    return {
      action: "apply_incoming",
      reason: "auto_fill",
      resolvedValue: incoming!,
      requiresAdvisorReview: false,
    };
  }

  // Case 3: both non-empty — check for identity (normalised).
  if (normalise(existing) === normalise(incoming)) {
    return {
      action: "keep_existing",
      reason: "identity",
      resolvedValue: existing ?? null,
      requiresAdvisorReview: false,
    };
  }

  // Case 4: both non-empty and different.

  // Manual data is protected — never auto-overwrite.
  if (existingSourceKind === "manual") {
    return {
      action: "flag_pending",
      reason: "manual_protected",
      resolvedValue: incoming!,
      requiresAdvisorReview: true,
    };
  }

  // Non-manual existing (ai_review / document / import) vs different incoming
  // → conflict; surface for advisor review but do not silently overwrite.
  return {
    action: "flag_pending",
    reason: "conflict",
    resolvedValue: incoming!,
    requiresAdvisorReview: true,
  };
}

// ─── Batch helper ─────────────────────────────────────────────────────────────

export interface FieldMergeInput {
  fieldKey: string;
  existing: string | null | undefined;
  incoming: string | null | undefined;
  existingSourceKind?: ContactSourceKind;
}

export interface FieldMergeOutput extends FieldMergeInput {
  decision: MergeDecision;
}

/**
 * Applies `resolveFieldMerge` over a batch of fields.
 * Returns each field with its decision attached.
 */
export function resolveFieldMergeBatch(fields: FieldMergeInput[]): FieldMergeOutput[] {
  return fields.map((f) => ({
    ...f,
    decision: resolveFieldMerge(f.existing, f.incoming, f.existingSourceKind),
  }));
}

/**
 * Returns true when any field in a batch requires advisor review.
 */
export function batchHasConflicts(results: FieldMergeOutput[]): boolean {
  return results.some((r) => r.decision.requiresAdvisorReview);
}
