/** Čisté parsování buněk importu kontaktů (bez server-only závislostí). */

const LIFECYCLE_DB = new Set(["lead", "prospect", "client", "former_client"]);

/**
 * Hodnota z Excelu/CSV → lifecycle_stage v DB, nebo null.
 * Akceptuje anglické klíče i české popisky z UI (Lead, Prospect, Klient, Bývalý klient).
 */
export function parseLifecycleStage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (LIFECYCLE_DB.has(lower)) return lower;

  const ascii = lower.normalize("NFD").replace(/\p{M}/gu, "");

  if (lower === "klient" || ascii === "klient") return "client";

  if (
    lower.includes("býval") ||
    ascii.includes("byval") ||
    lower.includes("former") ||
    ascii === "byvaly klient"
  ) {
    return "former_client";
  }

  return null;
}

/** Štítky oddělené středníkem nebo čárkou. */
export function parseTagsFromCell(raw: string): string[] | null {
  const t = raw.trim();
  if (!t) return null;
  const parts = t.includes(";") ? t.split(";") : t.split(",");
  const tags = parts.map((p) => p.trim()).filter(Boolean);
  return tags.length ? tags : null;
}
