/**
 * Client-safe segment code → display name map.
 * Canonical copy lives in `packages/db/src/schema/contracts.ts` (SEGMENT_LABELS).
 * Do not import `db` here — this file is used from `"use client"` modules and would pull postgres into the browser bundle.
 */
export const SEGMENT_LABELS: Record<string, string> = {
  ZP: "Životní pojištění",
  MAJ: "Majetek",
  ODP: "Odpovědnost",
  AUTO_PR: "Auto – povinné ručení",
  AUTO_HAV: "Auto – havarijní pojištění",
  CEST: "Cestovní pojištění",
  INV: "Investice",
  DIP: "Dlouhodobý investiční produkt (DIP)",
  DPS: "Doplňkové penzijní spoření (DPS)",
  HYPO: "Hypotéky",
  UVER: "Úvěry",
  FIRMA_POJ: "Pojištění firem",
};

export function segmentLabel(code: string): string {
  return SEGMENT_LABELS[code] ?? code;
}
