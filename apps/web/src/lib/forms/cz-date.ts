/**
 * Czech-style date display/entry: "d. m. yyyy" ↔ ISO "yyyy-mm-dd" for DB/API.
 */

const DIGIT_MAX = 8;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Strip leading zeros for display (9 not 09). */
function displayPart(n: string): string {
  const x = parseInt(n, 10);
  return Number.isNaN(x) ? n : String(x);
}

/**
 * Build "d. m. yyyy" display from digit sequence (max 8), using:
 * - day: first 2 digits
 * - month: next 1–2 digits (prefer 2 if value 01–12)
 * - year: remaining up to 4
 */
export function formatCzDateFromDigits(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, DIGIT_MAX);
  if (!d) return "";
  const dd = d.slice(0, 2);
  if (d.length <= 2) return dd;
  const rest = d.slice(2);
  if (rest.length === 0) return `${dd}. `;
  let monthRaw: string;
  let yearDigits: string;
  if (rest.length === 1) {
    monthRaw = rest;
    yearDigits = "";
  } else {
    const m2 = rest.slice(0, 2);
    const n2 = parseInt(m2, 10);
    if (n2 >= 1 && n2 <= 12) {
      monthRaw = m2;
      yearDigits = rest.slice(2);
    } else {
      monthRaw = rest.slice(0, 1);
      yearDigits = rest.slice(1);
    }
  }
  let out = `${displayPart(dd)}. ${displayPart(monthRaw)}`;
  if (!yearDigits) return out;
  return `${out}. ${yearDigits}`;
}

/** Extract digit sequence from a possibly partially formatted CZ date string. */
export function digitsFromCzDateInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, DIGIT_MAX);
}

/** ISO yyyy-mm-dd → "d. m. yyyy" for display. */
export function formatCzDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!month || !day || month > 12 || day > 31) return "";
  return `${day}. ${month}. ${year}`;
}

/** Parse "d. m. yyyy" (flexible spaces) to ISO or null. */
export function parseCzDateToIso(display: string): string | null {
  const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export type CzDateValidation = { ok: true; iso: string } | { ok: false; message: string };

export function validateCzDateComplete(display: string): CzDateValidation {
  const trimmed = display.trim();
  if (!trimmed) return { ok: false, message: "" };
  const iso = parseCzDateToIso(trimmed);
  if (!iso) return { ok: false, message: "Zadejte platné datum (den. měsíc. rok)." };
  return { ok: true, iso };
}

/** Alias for API fields: same as parseCzDateToIso. */
export function normalizeDateForApi(display: string): string | null {
  return parseCzDateToIso(display);
}
