/**
 * FA → Investment calculator adapter.
 * Maps financial analysis strategy data to projection inputs and runs the same
 * engine + chart adapter. No duplicate logic; parity: same initial/monthly/years/rate
 * as in calculator → same projection and chart.
 */

import type { ProjectionInputs, ProjectionResult } from "./investment.engine";
import type { InvestmentProfile } from "./investment.config";
import type { GrowthChartData } from "./investment.charts";
import { computeProjection } from "./investment.engine";
import { getGrowthChartData } from "./investment.charts";
import { INVESTMENT_PROFILES } from "./investment.config";
import { strategyTotals } from "@/lib/analyses/financial/calculations";
import { getProfileRate } from "@/lib/analyses/financial/formatters";
import type { InvestmentEntry } from "@/lib/analyses/financial/types";

const RETIREMENT_AGE = 65;
const YEARS_MIN = 1;
const YEARS_MAX = 30;

export interface FaStrategySlice {
  investments: InvestmentEntry[];
  strategy: { profile?: string; conservativeMode?: boolean };
  /** Optional: client birthDate (YYYY) for years-to-retirement fallback */
  client?: { birthDate?: string } | null;
}

/** Build a synthetic profile with given rate (in percent, e.g. 7 for 7% p.a.). */
function syntheticProfile(ratePercent: number): InvestmentProfile {
  const base = INVESTMENT_PROFILES[1];
  return {
    ...base,
    id: "fa-embedded",
    name: "Projekce",
    rate: ratePercent,
  };
}

/**
 * Map FA strategy slice to projection inputs, run engine, return result + chart data.
 * Uses same computeProjection and getGrowthChartData as standalone calculator.
 */
export function getProjectionFromFaStrategy(slice: FaStrategySlice): {
  projectionResult: ProjectionResult;
  growthChartData: GrowthChartData;
  hasInputs: boolean;
} {
  const { investments, strategy, client } = slice;
  const conservativeMode = strategy?.conservativeMode ?? false;
  const totals = strategyTotals(investments ?? [], conservativeMode);

  let rateDecimal = getProfileRate(strategy?.profile ?? "balanced");
  if (conservativeMode) rateDecimal = Math.max(0, rateDecimal - 0.02);
  const ratePercent = Math.round(rateDecimal * 100);

  const initial = totals.totalLump ?? 0;
  const monthly = totals.totalMonthly ?? 0;

  let years: number;
  const withAmount = (investments ?? []).filter((i) => (i.amount ?? 0) > 0);
  if (withAmount.length > 0) {
    years = Math.max(...withAmount.map((i) => i.years ?? 10), 1);
  } else if (client?.birthDate) {
    const birthYear = parseInt(String(client.birthDate).slice(0, 4), 10);
    if (!Number.isNaN(birthYear)) {
      const age = new Date().getFullYear() - birthYear;
      years = Math.max(YEARS_MIN, Math.min(YEARS_MAX, RETIREMENT_AGE - age));
    } else {
      years = 10;
    }
  } else {
    years = 10;
  }
  years = Math.max(YEARS_MIN, Math.min(YEARS_MAX, years));

  const profile = syntheticProfile(ratePercent);
  const inputs: ProjectionInputs = { initial, monthly, years, profile };
  const projectionResult = computeProjection(inputs);
  const growthChartData = getGrowthChartData(projectionResult, profile.color);

  const hasInputs = initial > 0 || monthly > 0;

  return { projectionResult, growthChartData, hasInputs };
}
