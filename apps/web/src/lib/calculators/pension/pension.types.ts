/**
 * Pension calculator – types (1:1 with penzijni.html state and outputs).
 */

export type PensionScenario = "optimistic" | "realistic";

export interface PensionState {
  age: number;
  retireAge: number;
  salary: number;
  rent: number;
  scenario: PensionScenario;
}

export interface PensionResult {
  estimatedPension: number;
  monthlyGap: number;
  monthlyInvestment: number;
  targetCapital: number;
}
