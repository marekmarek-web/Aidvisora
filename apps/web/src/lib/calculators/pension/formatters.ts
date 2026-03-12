/**
 * Pension calculator – formatting (1:1 with penzijni.html).
 */

export function formatCurrency(num: number): string {
  return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseCurrency(str: string): number {
  return parseInt(str.replace(/\s/g, ""), 10) || 0;
}
