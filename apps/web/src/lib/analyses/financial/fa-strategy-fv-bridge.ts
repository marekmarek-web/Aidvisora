/**
 * Napojení kroku „Strategie / investiční mřížka“ ve finanční analýze na sdílený FV kalkulátor
 * (`computePortalInvestmentFutureValue`). Žádné paralelní výpočty podle jiné sazby než portál + evidence.
 */

import type { InvestmentEntry } from "./types";
import type { BaseFund } from "./fund-library/types";
import { getBaseFundFromProductKey } from "./fund-library/helpers";
import {
  computePortalInvestmentFutureValue,
  resolvePortalFvAnnualRatePercentAdjusted,
  type PortalFvInputs,
} from "@/lib/fund-library/shared-future-value";
import type { FvSourceType, ResolvedFundCategory } from "db";

function resolvedCategoryFromCatalogFund(fund: BaseFund): ResolvedFundCategory | null {
  const cat = `${fund.category} ${fund.subcategory ?? ""}`.toLowerCase();
  if (cat.includes("penzijní")) {
    if (cat.includes("kon") || cat.includes("dluh") || cat.includes("peněž")) return "dps_conservative";
    if (cat.includes("vyváž")) return "dps_balanced";
    return "dps_dynamic";
  }
  if (cat.includes("nemovitost")) return "real_estate";
  if (cat.includes("peněžní") || cat.includes("dluhopis")) return "bond";
  if (cat.includes("vyváž") || cat.includes("multi-asset") || cat.includes("target")) return "balanced";
  if (cat.includes("akciov") || cat.includes("etf")) return "equity";
  if (cat.includes("kon") && cat.includes("fond")) return "conservative";
  return null;
}

export function buildPortalFvInputsForStrategyInvestment(
  inv: InvestmentEntry,
  conservativeMode: boolean,
): PortalFvInputs {
  const rawYears = inv.years ?? 10;
  const years = Math.round(Number.isFinite(rawYears) ? rawYears : 10);
  const boundedYears = years > 0 && years <= 80 ? years : null;

  const fund = getBaseFundFromProductKey(inv.productKey);
  const manualPct = (inv.annualRate ?? 0.07) * 100;
  const adj = conservativeMode ? -2 : 0;

  let fvSourceType: FvSourceType;
  let resolvedFundId: string | null = null;
  let resolvedFundCategory: ResolvedFundCategory | null = null;
  let manualAnnualRatePercent: number | undefined;

  if (fund?.planningRate != null && Number.isFinite(fund.planningRate) && fund.planningRate > 0) {
    fvSourceType = "fund-library";
    resolvedFundId = fund.baseFundKey;
  } else if (fund) {
    const cat = resolvedCategoryFromCatalogFund(fund);
    if (cat) {
      fvSourceType = "heuristic-fallback";
      resolvedFundCategory = cat;
    } else {
      fvSourceType = "manual";
      manualAnnualRatePercent = manualPct;
    }
  } else {
    fvSourceType = "manual";
    manualAnnualRatePercent = manualPct;
  }

  return {
    fvSourceType,
    resolvedFundId,
    resolvedFundCategory,
    investmentHorizon: null,
    horizonYearsExplicit: boundedYears,
    monthlyContribution: inv.type === "lump" ? null : inv.amount,
    annualContribution: null,
    lumpContribution: inv.type === "lump" ? inv.amount : null,
    manualAnnualRatePercent,
    annualRateAdjustmentPercentPoints: adj,
  };
}

export function computeStrategyInvestmentFv(inv: InvestmentEntry, conservativeMode: boolean): number {
  const input = buildPortalFvInputsForStrategyInvestment(inv, conservativeMode);
  return computePortalInvestmentFutureValue(input)?.amount ?? 0;
}

/**
 * Efektivní modelová sazba (% p.a.) pro grafy a průměrnou sazbu v sekci projekce.
 * Při neúspěchu rozlišení zůstává vstupní sazba z mřížky (legacy pole `annualRate`).
 */
export function modelingAnnualPercentForStrategyInvestment(
  inv: InvestmentEntry,
  conservativeMode: boolean,
): number {
  const input = buildPortalFvInputsForStrategyInvestment(inv, conservativeMode);
  const resolved = resolvePortalFvAnnualRatePercentAdjusted(input);
  if (resolved != null) return resolved;
  const fallback = (inv.annualRate ?? 0.07) * 100;
  return Math.max(0.1, fallback + (conservativeMode ? -2 : 0));
}
