/**
 * Mortgage calculator – number/currency formatting (1:1 with HTML).
 */

export function formatCurrency(num: number): string {
  return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseCurrency(str: string): number {
  return parseInt(str.replace(/\s/g, "").replace(" ", ""), 10) || 0;
}

/** Format rate for display: "4,19 %" */
export function formatRate(rate: number): string {
  return rate.toFixed(2).replace(".", ",") + " %";
}
