/**
 * KPI přehledu kontaktu — stejný vstup jako seznam produktů: jen manual + ai_review,
 * agregace přes mapContractToCanonicalProduct (žádná paralelní SQL suma).
 */

import type { ContractRow } from "@/app/actions/contracts";
import { mapContractToCanonicalProduct } from "@/lib/products/canonical-product-read";
import type { CanonicalProduct } from "@/lib/products/canonical-product-read";
import { resolveFvMonthlyContribution } from "./portal-portfolio-display";

const INVEST_SEGMENTS = new Set(["INV", "DIP", "DPS"]);
const INSURANCE_SEGMENTS = new Set(["ZP", "MAJ", "ODP", "AUTO_PR", "AUTO_HAV", "CEST", "FIRMA_POJ"]);

/** Zdroje zadané poradcem nebo z AI Review (publikovaná evidence). */
export const ADVISOR_PRODUCT_SOURCE_KINDS = new Set(["manual", "ai_review"]);

export type ContactOverviewKpiNumbers = {
  monthlyInvest: number;
  personalAum: number;
  monthlyInsurance: number;
  annualInsurance: number;
};

function monthlyCashflowForKpi(p: CanonicalProduct): number {
  if (INVEST_SEGMENTS.has(p.segment)) {
    const v = resolveFvMonthlyContribution(p);
    if (v != null && v > 0) return v;
    return p.premiumMonthly ?? 0;
  }
  if (p.segment === "HYPO" || p.segment === "UVER") {
    if (p.segmentDetail?.kind === "loan" && p.segmentDetail.monthlyPayment != null && p.segmentDetail.monthlyPayment > 0) {
      return p.segmentDetail.monthlyPayment;
    }
    return p.premiumMonthly ?? 0;
  }
  if (p.segmentDetail?.kind === "life_insurance" && p.segmentDetail.monthlyPremium != null && p.segmentDetail.monthlyPremium > 0) {
    return p.segmentDetail.monthlyPremium;
  }
  return p.premiumMonthly ?? 0;
}

function annualAmountForKpi(p: CanonicalProduct): number {
  if (p.segmentDetail?.kind === "life_insurance" && p.segmentDetail.annualPremium != null && p.segmentDetail.annualPremium > 0) {
    return p.segmentDetail.annualPremium;
  }
  return p.premiumAnnual ?? 0;
}

export function computeContactOverviewKpiFromContracts(contracts: ContractRow[]): ContactOverviewKpiNumbers {
  const filtered = contracts.filter((c) => ADVISOR_PRODUCT_SOURCE_KINDS.has(c.sourceKind));
  let monthlyInvest = 0;
  let personalAum = 0;
  let monthlyInsurance = 0;
  let annualInsurance = 0;

  for (const c of filtered) {
    const p = mapContractToCanonicalProduct(c);
    const seg = p.segment;
    const m = monthlyCashflowForKpi(p);
    const a = annualAmountForKpi(p);
    if (INVEST_SEGMENTS.has(seg)) {
      monthlyInvest += m;
      personalAum += a;
    } else if (INSURANCE_SEGMENTS.has(seg)) {
      monthlyInsurance += m;
      annualInsurance += a;
    }
  }

  return { monthlyInvest, personalAum, monthlyInsurance, annualInsurance };
}
