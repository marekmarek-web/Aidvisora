/**
 * Life insurance calculator – types (1:1 with zivotni.html state and outputs).
 */

export interface LifeState {
  age: number;
  netIncome: number;
  expenses: number;
  liabilities: number;
  reserves: number;
  children: number;
  hasSpouse: boolean;
}

export interface LifeChartDataItem {
  label: string;
  prijem: number;
  stat: number;
  chybi: number;
}

export interface LifeResult {
  deathCoverage: number;
  capitalD3: number;
  pnDailyNeed: number;
  tnBase: number;
  tnProgression: number;
  chartData: LifeChartDataItem[];
  /** For Invalidita subtext: netIncome - pensionD3 */
  gapD3Renta: number;
}
