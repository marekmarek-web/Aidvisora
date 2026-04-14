/**
 * Run: pnpm vitest run src/lib/analyses/financial/__tests__/fa-strategy-fv-bridge.test.ts
 */
import { describe, it, expect } from "vitest";
import { computeStrategyInvestmentFv, buildPortalFvInputsForStrategyInvestment } from "../fa-strategy-fv-bridge";
import { computePortalInvestmentFutureValue } from "@/lib/fund-library/shared-future-value";
import type { InvestmentEntry } from "../types";

describe("fa-strategy-fv-bridge", () => {
  it("aligns strategy row FV with shared portal calculator for catalog fund", () => {
    const inv: InvestmentEntry = {
      id: 1,
      productKey: "conseq_globalni_akciovy_ucastnicky",
      type: "monthly",
      amount: 1000,
      years: 10,
      annualRate: 0.12,
    };
    const portal = computePortalInvestmentFutureValue({
      fvSourceType: "fund-library",
      resolvedFundId: "conseq_globalni_akciovy_ucastnicky",
      resolvedFundCategory: null,
      investmentHorizon: null,
      horizonYearsExplicit: 10,
      monthlyContribution: 1000,
      annualContribution: null,
      annualRateAdjustmentPercentPoints: 0,
    });
    const strategy = computeStrategyInvestmentFv(inv, false);
    expect(portal).not.toBeNull();
    expect(strategy).toBe(portal!.amount);
  });

  it("buildPortalFvInputsForStrategyInvestment marks fund-library when planning rate exists", () => {
    const inv: InvestmentEntry = {
      id: 2,
      productKey: "ishares_core_msci_world",
      type: "monthly",
      amount: 500,
      years: 15,
      annualRate: 0.08,
    };
    const input = buildPortalFvInputsForStrategyInvestment(inv, true);
    expect(input.fvSourceType).toBe("fund-library");
    expect(input.resolvedFundId).toBe("ishares_core_msci_world");
    expect(input.annualRateAdjustmentPercentPoints).toBe(-2);
  });
});
