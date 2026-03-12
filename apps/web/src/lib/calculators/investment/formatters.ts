/**
 * Investment calculator – number/currency formatting (1:1 with HTML).
 */

/**
 * Format number as Czech currency string with space as thousands separator.
 * No decimals for display; same as HTML formatCurrency.
 */
export function formatCurrency(num: number): string {
  return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Parse display string back to number (strips spaces).
 */
export function parseCurrency(str: string): number {
  return parseInt(str.replace(/\s/g, ""), 10) || 0;
}
