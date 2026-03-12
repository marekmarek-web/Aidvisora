/**
 * Pension calculator – config (1:1 with penzijni.html).
 */

import type { PensionScenario } from "./pension.types";

export const LIMITS = {
  age: { min: 18, max: 64, step: 1, default: 35 },
  retireAge: { min: 60, max: 70, step: 1, default: 65 },
  salary: { min: 15_000, max: 200_000, step: 1_000, default: 45_000 },
  rent: { min: 10_000, max: 150_000, step: 1_000, default: 35_000 },
} as const;

export const DEFAULT_STATE = {
  age: 35,
  retireAge: 65,
  salary: 45_000,
  rent: 35_000,
  scenario: "realistic" as PensionScenario,
} as const;

export const SCENARIO_OPTIONS: { value: PensionScenario; label: string }[] = [
  { value: "optimistic", label: "Optimistický (Dnešní stav)" },
  { value: "realistic", label: "Realistický (Demografický pokles)" },
];
