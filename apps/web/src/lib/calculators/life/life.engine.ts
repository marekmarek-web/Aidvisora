/**
 * Life insurance calculator – pure calculation engine (1:1 with zivotni.html).
 * No DOM; all inputs via LifeState, output LifeResult.
 *
 * Parity (verified vs html/zivotni.html):
 * - Scenario: age 30, netIncome 30k, expenses 20k, liabilities 2M, reserves 100k, children 2, hasSpouse true
 *   → same deathCoverage, capitalD3, pnDailyNeed, tnBase, tnProgression, chartData.
 * - PN: calculateSicknessBenefit (rh1/rh2/rh3), pnDailyNeed ceil to 100.
 * - D3: pensionD3 brackets, capitalD3 = roundTo10k(PV - reserves).
 * - Smrt: familyProtection, deathCoverage; if no children and no spouse and no liabilities → 0.
 * - TN: tnBase 1M/2M/3M by income, tnProgression = tnBase * 10.
 */

import { roundTo10k } from "./formatters";
import { RH1, RH2, RH3, CAPITAL_RATE, RETIREMENT_AGE, NET_TO_GROSS_FACTOR } from "./life.constants";
import type { LifeState, LifeResult, LifeChartDataItem } from "./life.types";

/** Měsíční ekvivalent státní nemocenské (odhad z hrubého ročního příjmu). */
export function calculateSicknessBenefit(grossIncome: number): number {
  const dailyGross = (grossIncome * 12) / 365;
  let reducedDaily = 0;
  if (dailyGross <= RH1) reducedDaily = dailyGross * 0.9;
  else if (dailyGross <= RH2)
    reducedDaily = RH1 * 0.9 + (dailyGross - RH1) * 0.6;
  else if (dailyGross <= RH3)
    reducedDaily =
      RH1 * 0.9 + (RH2 - RH1) * 0.6 + (dailyGross - RH2) * 0.3;
  else
    reducedDaily =
      RH1 * 0.9 + (RH2 - RH1) * 0.6 + (RH3 - RH2) * 0.3;

  const dailyBenefit = reducedDaily * 0.66;
  return Math.round(dailyBenefit * 30);
}

/** PV kapitálu na dorovnání měsíční mezery po dobu yearsToCover při 6 % p.a. */
export function calculateCapitalNeeded(
  monthlyGap: number,
  yearsToCover: number
): number {
  if (monthlyGap <= 0) return 0;
  if (yearsToCover <= 0) return 0;
  const annualGap = monthlyGap * 12;
  const pv =
    annualGap * ((1 - Math.pow(1 + CAPITAL_RATE, -yearsToCover)) / CAPITAL_RATE);
  return Math.round(pv);
}

/** Hlavní výpočet – 1:1 s runCalculations() v zivotni.html. */
export function runCalculations(state: LifeState): LifeResult {
  const {
    age,
    netIncome,
    expenses,
    liabilities,
    reserves,
    children,
    hasSpouse,
  } = state;

  const estimatedGrossIncome = Math.round(netIncome / NET_TO_GROSS_FACTOR);
  const yearsToRetirement = Math.max(0, RETIREMENT_AGE - age);
  const targetMonthlyIncome = Math.max(expenses, netIncome);

  // 1. PN (Pracovní neschopnost)
  const stateSicknessMonthly = calculateSicknessBenefit(estimatedGrossIncome);
  const pnGapMonthly = Math.max(0, netIncome - stateSicknessMonthly);
  const pnDailyNeed = Math.ceil((pnGapMonthly / 30) / 100) * 100;

  // 2. Invalidita (D3)
  let pensionD3 = 0;
  if (netIncome < 20000) pensionD3 = netIncome * 0.85;
  else if (netIncome < 40000) pensionD3 = netIncome * 0.55;
  else if (netIncome < 80000)
    pensionD3 = 22000 + (netIncome - 40000) * 0.15;
  else pensionD3 = 25000 + (netIncome - 100000) * 0.1;

  const gapD3 = Math.max(0, targetMonthlyIncome - pensionD3);
  const capitalD3Raw = Math.max(
    0,
    calculateCapitalNeeded(gapD3, yearsToRetirement) - reserves
  );
  const capitalD3 = roundTo10k(capitalD3Raw);
  const gapD3Renta = Math.max(0, netIncome - pensionD3);

  // 3. Smrt
  const survivorStateSupport = hasSpouse || children > 0 ? 10000 : 0;

  let capitalDeathIncome = 0;
  if (hasSpouse || children > 0) {
    const deathGapMonthly = Math.max(
      0,
      targetMonthlyIncome - survivorStateSupport
    );
    capitalDeathIncome = calculateCapitalNeeded(
      deathGapMonthly,
      yearsToRetirement
    );
  }

  let spouseLumpSum = 0;
  if (hasSpouse) {
    if (age < 40) spouseLumpSum = 4_000_000;
    else if (age < 50) spouseLumpSum = 2_000_000;
    else spouseLumpSum = 1_000_000;
  }

  let childrenLumpSum = 0;
  if (children > 0) {
    let perChild = 0;
    if (age < 50) perChild = 1_000_000;
    else if (age < 60) perChild = 500_000;
    else perChild = 0;
    childrenLumpSum = children * perChild;
  }

  const familyProtection = Math.max(
    capitalDeathIncome,
    spouseLumpSum + childrenLumpSum
  );

  let deathCoverageRaw = Math.max(
    0,
    liabilities + familyProtection - reserves
  );
  if (children === 0 && !hasSpouse && liabilities === 0) {
    deathCoverageRaw = 0;
  }
  const deathCoverage = roundTo10k(deathCoverageRaw);

  // 4. Trvalé následky (TN)
  let tnBase = 1_000_000;
  if (netIncome > 100_000) tnBase = 3_000_000;
  else if (netIncome > 30_000) tnBase = 2_000_000;
  const tnProgression = tnBase * 10;

  const chartData: LifeChartDataItem[] = [
    {
      label: "PN (měs.)",
      prijem: netIncome,
      stat: stateSicknessMonthly,
      chybi: pnGapMonthly,
    },
    {
      label: "Invalidita (měs.)",
      prijem: netIncome,
      stat: pensionD3,
      chybi: gapD3,
    },
  ];

  return {
    deathCoverage,
    capitalD3,
    pnDailyNeed,
    tnBase,
    tnProgression,
    chartData,
    gapD3Renta,
  };
}
