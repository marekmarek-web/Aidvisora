import { describe, expect, it } from "vitest";
import {
  defaultLoanFormState,
  defaultMortgageFormState,
  parseMortgageCalculatorSession,
} from "../mortgageSessionStorage";

describe("parseMortgageCalculatorSession", () => {
  it("round-trips valid payload", () => {
    const mortgage = { ...defaultMortgageFormState(), loan: 2_000_000, term: 10 };
    const loan = { ...defaultLoanFormState(), loan: 350_000 };
    const raw = JSON.stringify({ mortgage, loan, lastActive: "mortgage" as const });
    const parsed = parseMortgageCalculatorSession(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.mortgage.loan).toBe(2_000_000);
    expect(parsed!.mortgage.term).toBe(10);
    expect(parsed!.lastActive).toBe("mortgage");
  });

  it("rejects invalid JSON", () => {
    expect(parseMortgageCalculatorSession("")).toBeNull();
    expect(parseMortgageCalculatorSession("{}")).toBeNull();
  });
});
