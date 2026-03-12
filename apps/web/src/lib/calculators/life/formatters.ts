/**
 * Life insurance calculator – formatting (1:1 with zivotni.html).
 */

/** cs-CZ, no decimals, comma replaced by space. */
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "decimal",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
    .format(val)
    .replace(/,/g, " ");
}

export function parseCurrency(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, ""), 10) || 0;
}

/** Zaokrouhlení na nejbližší 10 000. */
export function roundTo10k(val: number): number {
  return Math.round(val / 10000) * 10000;
}
