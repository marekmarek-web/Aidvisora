/**
 * Pension calculator – pure calculation engine (1:1 with penzijni.html).
 * No DOM; all inputs via PensionState, output PensionResult.
 *
 * Parity checklist (same as penzijni.html calculate()):
 * - (35, 65, 45_000, 35_000, realistic) → estimatedPension ~14_364, monthlyGap 20_636, targetCapital ~3.38e6, monthlyInvestment ~3_8xx Kč
 * - (40, 67, 60_000, 40_000, optimistic) → no malus, bonus for 67; baseRate 0.42 → estimatedPension 25_200 * 1.03 ≈ 25_956
 */

import {
  EXPECTED_RETURN,
  INFLATION,
  YEARS_IN_RETIREMENT,
  RETIREMENT_REAL_RATE_ANNUAL,
  BASE_RATE_SALARY_BREAKS,
  BASE_RATE_DEFAULT,
  MALUS_PER_YEAR,
  BONUS_PER_YEAR,
  EARLY_MALUS_PER_YEAR,
  STANDARD_RETIREMENT_AGE,
} from "./pension.constants";
import type { PensionState, PensionResult } from "./pension.types";

function getBaseRate(salary: number): number {
  for (const { max, rate } of BASE_RATE_SALARY_BREAKS) {
    if (salary < max) return rate;
  }
  return BASE_RATE_DEFAULT;
}

/** Main calculation – 1:1 with calculate() in penzijni.html. */
export function runCalculations(state: PensionState): PensionResult {
  const { age, retireAge, salary, rent, scenario } = state;

  const baseRate = getBaseRate(salary);
  let estimatedPension = salary * baseRate;

  const yearsToRetirement = retireAge - age;

  if (scenario === "realistic") {
    const malusFactor = yearsToRetirement * MALUS_PER_YEAR;
    estimatedPension = estimatedPension * (1 - malusFactor);
  }

  if (retireAge > STANDARD_RETIREMENT_AGE) {
    const extraYears = retireAge - STANDARD_RETIREMENT_AGE;
    const bonusFactor = extraYears * BONUS_PER_YEAR;
    estimatedPension = estimatedPension * (1 + bonusFactor);
  } else if (retireAge < STANDARD_RETIREMENT_AGE) {
    const missingYears = STANDARD_RETIREMENT_AGE - retireAge;
    const earlyMalus = missingYears * EARLY_MALUS_PER_YEAR;
    estimatedPension = estimatedPension * (1 - earlyMalus);
  }

  estimatedPension = Math.round(Math.max(0, estimatedPension));

  let monthlyGap = rent - estimatedPension;
  if (monthlyGap < 0) monthlyGap = 0;

  let monthlyInvestment = 0;
  let targetCapital = 0;

  if (yearsToRetirement > 0) {
    const realRate = (1 + EXPECTED_RETURN) / (1 + INFLATION) - 1;
    const monthsInRetirement = YEARS_IN_RETIREMENT * 12;
    const retirementRealRateMonthly = RETIREMENT_REAL_RATE_ANNUAL / 12;

    targetCapital =
      (monthlyGap *
        (1 - Math.pow(1 + retirementRealRateMonthly, -monthsInRetirement))) /
      retirementRealRateMonthly;

    const accumulationRateMonthly = realRate / 12;
    const monthsAccumulation = yearsToRetirement * 12;
    monthlyInvestment =
      (targetCapital * accumulationRateMonthly) /
      (Math.pow(1 + accumulationRateMonthly, monthsAccumulation) - 1);
  }

  return {
    estimatedPension,
    monthlyGap,
    monthlyInvestment,
    targetCapital,
  };
}
