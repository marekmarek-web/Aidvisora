/**
 * Investment calculator – chart data adapters.
 * Transform engine/backtest output into Chart.js and ApexCharts format.
 * No business logic; reusable for Financial Analysis.
 */

import type { ProjectionResult } from "./investment.engine";
import type { InvestmentProfile } from "./investment.config";
import type { BacktestResult } from "./investment.backtest";
import { BACKTEST_CHART_COLORS } from "./investment.constants";

/** Chart.js Line: labels + two datasets (balance, invested) */
export interface GrowthChartData {
  labels: string[];
  balanceData: number[];
  investedData: number[];
  profileColor: string;
}

export function getGrowthChartData(
  result: ProjectionResult,
  profileColor: string
): GrowthChartData {
  return {
    labels: result.growthPoints.map((p) => p.label),
    balanceData: result.growthPoints.map((p) => p.balance),
    investedData: result.growthPoints.map((p) => p.invested),
    profileColor,
  };
}

/** Chart.js Doughnut: labels + values + colors from profile */
export interface AllocationChartData {
  labels: string[];
  values: number[];
  colors: string[];
}

export function getAllocationChartData(
  profile: InvestmentProfile
): AllocationChartData {
  return {
    labels: profile.composition.map((c) => c.name),
    values: profile.composition.map((c) => c.value),
    colors: profile.composition.map((c) => c.color),
  };
}

/** ApexCharts series for backtest (name + data). Order matches HTML. */
export interface BacktestChartSeriesItem {
  name: string;
  type: "area" | "line";
  data: [number, number][];
}

const BACKTEST_SERIES_NAMES = [
  "Vloženo celkem",
  "S&P 500",
  "Zlato",
  "Dluhopisy",
  "Nemovitostní fondy",
] as const;

export function getBacktestChartSeries(
  backtestResult: BacktestResult
): BacktestChartSeriesItem[] {
  return [
    {
      name: BACKTEST_SERIES_NAMES[0],
      type: "area",
      data: backtestResult.invested,
    },
    {
      name: BACKTEST_SERIES_NAMES[1],
      type: "area",
      data: backtestResult.sp500,
    },
    {
      name: BACKTEST_SERIES_NAMES[2],
      type: "line",
      data: backtestResult.gold,
    },
    {
      name: BACKTEST_SERIES_NAMES[3],
      type: "line",
      data: backtestResult.bonds,
    },
    {
      name: BACKTEST_SERIES_NAMES[4],
      type: "line",
      data: backtestResult.re,
    },
  ];
}

export { BACKTEST_CHART_COLORS };
