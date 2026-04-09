import { formatInTimeZone } from "date-fns-tz";

const PRAGUE = "Europe/Prague";

/**
 * Formátuje kalendářní datum YYYY-MM-DD pro zobrazení uživateli (dd.MM.yyyy, wall time Praha).
 * U date-only řetězců používá poledne lokálně, aby se předešlo posunu při DST.
 */
export function formatDisplayDateCs(isoYmd: string | null | undefined): string {
  if (isoYmd == null) return "";
  const s = String(isoYmd).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  try {
    return formatInTimeZone(`${s}T12:00:00`, PRAGUE, "dd.MM.yyyy");
  } catch {
    return "";
  }
}

/** Stejné jako formatDisplayDateCs, nebo výchozí zástupný text. */
export function formatDisplayDateCsOr(isoYmd: string | null | undefined, or: string): string {
  return formatDisplayDateCs(isoYmd) || or;
}
