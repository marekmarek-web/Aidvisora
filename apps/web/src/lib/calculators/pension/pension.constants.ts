/**
 * Pension calculator – constants (1:1 with penzijni.html).
 */

/** Očekávaný výnos 7 % p.a. */
export const EXPECTED_RETURN = 0.07;

/** Inflace 2 % pro reálný výnos. */
export const INFLATION = 0.02;

/** Roky v důchodu pro PV anuity. */
export const YEARS_IN_RETIREMENT = 20;

/** Bezpečný výběr 1,5 % p.a. → měsíční sazba. */
export const RETIREMENT_REAL_RATE_ANNUAL = 0.015;

/** Náhradový poměr (baseRate) podle mzdy: salary < 20k → 0.55; < 40k → 0.48; < 60k → 0.42; < 80k → 0.35; else 0.28. */
export const BASE_RATE_SALARY_BREAKS = [
  { max: 20_000, rate: 0.55 },
  { max: 40_000, rate: 0.48 },
  { max: 60_000, rate: 0.42 },
  { max: 80_000, rate: 0.35 },
] as const;

export const BASE_RATE_DEFAULT = 0.28;

/** Realistický scénář: penalizace 0,8 % za každý rok do důchodu. */
export const MALUS_PER_YEAR = 0.008;

/** Bonus za odchod po 65: 1,5 % za rok. */
export const BONUS_PER_YEAR = 0.015;

/** Malus za předčasný odchod: 5 % za rok před 65. */
export const EARLY_MALUS_PER_YEAR = 0.05;

export const STANDARD_RETIREMENT_AGE = 65;
