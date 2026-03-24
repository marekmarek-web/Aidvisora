/**
 * Shared structure for calculator PDF export (text sections → pdf-lib).
 */

export interface CalculatorPdfRow {
  label: string;
  value: string;
}

export interface CalculatorPdfSection {
  title: string;
  rows: CalculatorPdfRow[];
}
