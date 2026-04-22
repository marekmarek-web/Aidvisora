/**
 * Pure confidence → label / level mapping used by the AI Review panel's confidence pill.
 *
 * Extracted from `ExtractionLeftPanel.tsx` so it can be unit-tested without React /
 * happy-dom. UI colors stay in the component; this module is only about the label
 * + categorical bucket.
 */

export type ConfidenceLevel = "vysoka" | "stredni" | "nizka";

export type ConfidencePillInfo = {
  /** Display label in Czech. `null` means the pill should not render. */
  label: "Vysoká" | "Střední" | "Nízká" | null;
  /** Level bucket exposed as `data-confidence-level` — used by tests and analytics. */
  level: ConfidenceLevel | null;
  /** Clamped 0–100 integer confidence. `null` when input was non-finite. */
  clamped: number | null;
};

/**
 * Resolve a pill label from a raw percent (0–100) confidence and a `hasValue` flag.
 *
 * Rules:
 * - `hasValue=false` → pill hidden (no confidence on an empty field).
 * - non-finite / NaN confidence → pill hidden (we do not render "unknown").
 * - `>= 85` → "Vysoká" (green).
 * - `50–84` → "Střední" (amber).
 * - `< 50` → "Nízká" (red).
 */
export function resolveConfidencePill(
  confidencePercent: number,
  hasValue: boolean
): ConfidencePillInfo {
  if (!hasValue) return { label: null, level: null, clamped: null };
  if (typeof confidencePercent !== "number" || !Number.isFinite(confidencePercent)) {
    return { label: null, level: null, clamped: null };
  }
  const clamped = Math.max(0, Math.min(100, Math.round(confidencePercent)));
  if (clamped >= 85) return { label: "Vysoká", level: "vysoka", clamped };
  if (clamped >= 50) return { label: "Střední", level: "stredni", clamped };
  return { label: "Nízká", level: "nizka", clamped };
}
