/**
 * Investment calculator – historical backtest simulation (1:1 with HTML).
 * DCA from startYear using historicalData; returns time series for all asset classes.
 */

import type { HistoricalDataPoint } from "./investment.config";

/** [timestamp, value] for ApexCharts */
export type BacktestSeriesPoint = [number, number];

export interface BacktestResult {
  invested: BacktestSeriesPoint[];
  sp500: BacktestSeriesPoint[];
  gold: BacktestSeriesPoint[];
  bonds: BacktestSeriesPoint[];
  re: BacktestSeriesPoint[];
}

/**
 * Months between two dates (same logic as HTML getMonthsDiff).
 */
function getMonthsDiff(d1: Date, d2: Date): number {
  let m = (d2.getFullYear() - d1.getFullYear()) * 12;
  m -= d1.getMonth();
  m += d2.getMonth();
  return m <= 0 ? 0 : m;
}

/**
 * Run backtest: from startYear, accumulate units (deposit/price) per asset,
 * then value at each point = units * current price.
 * First period uses 1 month; between data points uses getMonthsDiff.
 */
export function runBacktest(
  monthlyDeposit: number,
  startYear: number,
  historicalData: HistoricalDataPoint[]
): BacktestResult {
  const targetStartDate = new Date(`${startYear}-01-01`);
  let startIndex = historicalData.findIndex(
    (d) => new Date(d.date) >= targetStartDate
  );
  if (startIndex === -1) startIndex = 0;

  let accInvested = 0;
  const units = { sp500: 0, gold: 0, bonds: 0, re: 0 };

  const series: BacktestResult = {
    invested: [],
    sp500: [],
    gold: [],
    bonds: [],
    re: [],
  };

  for (let i = startIndex; i < historicalData.length; i++) {
    const pt = historicalData[i];
    const currentDate = new Date(pt.date);
    let monthsPassed =
      i > startIndex
        ? getMonthsDiff(new Date(historicalData[i - 1].date), currentDate)
        : 1;
    if (monthsPassed < 1) monthsPassed = 1;

    const deposit = monthlyDeposit * monthsPassed;
    accInvested += deposit;

    units.sp500 += deposit / pt.sp500;
    units.gold += deposit / pt.gold;
    units.bonds += deposit / pt.bonds;
    units.re += deposit / pt.re;

    const ts = currentDate.getTime();
    series.invested.push([ts, accInvested]);
    series.sp500.push([ts, Math.round(units.sp500 * pt.sp500)]);
    series.gold.push([ts, Math.round(units.gold * pt.gold)]);
    series.bonds.push([ts, Math.round(units.bonds * pt.bonds)]);
    series.re.push([ts, Math.round(units.re * pt.re)]);
  }

  return series;
}
