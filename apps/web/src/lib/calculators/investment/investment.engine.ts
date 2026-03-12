/**
 * Investment calculator – projection calculation (1:1 with HTML calculate()).
 * Pure functions, no DOM. Reusable for Financial Analysis step later.
 */

import type { InvestmentProfile } from "./investment.config";

export interface ProjectionInputs {
  initial: number;
  monthly: number;
  years: number;
  profile: InvestmentProfile;
}

export interface ProjectionSummary {
  totalBalance: number;
  totalInvested: number;
  totalGain: number;
  totalGainPercent: number;
}

export interface GrowthDataPoint {
  label: string;
  balance: number;
  invested: number;
}

export interface ProjectionResult extends ProjectionSummary {
  growthPoints: GrowthDataPoint[];
}

/**
 * Compute projection: monthly compounding + regular deposits.
 * Same formula as HTML: for each year, 12 months of
 * currentBalance += currentBalance * (rate/100/12) + monthly;
 * totalInvested += monthly (each month).
 */
export function computeProjection(inputs: ProjectionInputs): ProjectionResult {
  const { initial, monthly, years, profile } = inputs;
  const rate = profile.rate;
  const monthlyRate = rate / 100 / 12;

  let currentBalance = initial;
  let totalInvested = initial;

  const growthPoints: GrowthDataPoint[] = [];
  growthPoints.push({
    label: "Start",
    balance: currentBalance,
    invested: totalInvested,
  });

  for (let i = 1; i <= years; i++) {
    for (let m = 0; m < 12; m++) {
      currentBalance += currentBalance * monthlyRate + monthly;
      totalInvested += monthly;
    }
    growthPoints.push({
      label: `${i}. rok`,
      balance: Math.round(currentBalance),
      invested: Math.round(totalInvested),
    });
  }

  const totalBalance = currentBalance;
  const totalGain = totalBalance - totalInvested;
  const totalGainPercent =
    totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return {
    totalBalance,
    totalInvested,
    totalGain,
    totalGainPercent,
    growthPoints,
  };
}
