/**
 * Pure helpers for AI Review provenance in advisor-facing UI (contracts, products preview).
 */

export type AiProvenanceKind = "confirmed" | "auto_applied" | "pending_review" | "manual";

/**
 * Ze sourceKind a advisorConfirmedAt urči provenance kind.
 * Vrací null pokud záznam není z AI Review.
 */
export function resolveAiProvenanceKind(
  sourceKind: string | null | undefined,
  advisorConfirmedAt: Date | string | null | undefined,
): AiProvenanceKind | null {
  if (sourceKind !== "ai_review") return null;
  return advisorConfirmedAt ? "confirmed" : "auto_applied";
}

/** Lidský popis contracts.sourceKind pro sekundární UI text. */
export function contractSourceKindLabel(kind: string): string {
  switch (kind) {
    case "document":
      return "Dokument";
    case "ai_review":
      return "AI kontrola";
    case "import":
      return "Import";
    default:
      return "Ručně";
  }
}
