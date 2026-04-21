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
  /** Součet skutečných pravidelných měsíčních příspěvků do investic. Jednorázovky se NEpočítají. */
  monthlyInvest: number;
  /**
   * Osobní AUM = veškerý spravovaný majetek v investičních produktech (INV/DIP/DPS).
   * Zahrnuje:
   *  - jednorázové investice (celá jistina),
   *  - pravidelné investice (preferuje `portfolioAttributes.intendedInvestment`,
   *    jinak roční ekvivalent měsíční splátky jako hrubý proxy).
   * Pojistné se do AUM NEpočítá.
   */
  personalAum: number;
  monthlyInsurance: number;
  annualInsurance: number;
};

/** Tolerantní parser pro string/číslo typu „1 000 000,50 Kč“. */
function parseAmountLoose(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).replace(/\s|Kč|CZK|EUR|USD/gi, "").replace(/,/g, ".").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function isOneTimeInvestment(p: CanonicalProduct): boolean {
  return p.segmentDetail?.kind === "investment" && p.segmentDetail.paymentType === "one_time";
}

/** Měsíční cashflow — u jednorázové investice vždy 0 (není to měsíční). */
function monthlyCashflowForKpi(p: CanonicalProduct): number {
  if (INVEST_SEGMENTS.has(p.segment)) {
    if (isOneTimeInvestment(p)) return 0;
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

/** Roční pojistné (ŽP + ostatní neživotní) — jen pro segmenty pojištění. */
function annualInsuranceAmountForKpi(p: CanonicalProduct): number {
  if (p.segmentDetail?.kind === "life_insurance" && p.segmentDetail.annualPremium != null && p.segmentDetail.annualPremium > 0) {
    return p.segmentDetail.annualPremium;
  }
  return p.premiumAnnual ?? 0;
}

/**
 * AUM jednoho investičního řádku.
 * - `one_time`: celá jistina — v `CanonicalProduct` je pro one-time uložena v `segmentDetail.monthlyContribution`
 *   (viz komentář u `InvestmentDetail.monthlyContribution`), jako fallback `premiumMonthly`, jinak
 *   `portfolioAttributes.intendedInvestment`.
 * - `regular`: preferujeme `portfolioAttributes.intendedInvestment` (celková plánovaná investice),
 *   jinak roční ekvivalent `premiumMonthly × 12` jako hrubý proxy.
 */
function investmentAumForRow(row: ContractRow, p: CanonicalProduct): number {
  if (!INVEST_SEGMENTS.has(p.segment)) return 0;

  const attrs = row.portfolioAttributes ?? {};
  const intended =
    parseAmountLoose((attrs as Record<string, unknown>).intendedInvestment) ||
    parseAmountLoose((attrs as Record<string, unknown>).investmentAmount) ||
    parseAmountLoose((attrs as Record<string, unknown>).targetAmount);

  if (isOneTimeInvestment(p)) {
    if (p.segmentDetail?.kind === "investment" && p.segmentDetail.monthlyContribution != null && p.segmentDetail.monthlyContribution > 0) {
      return p.segmentDetail.monthlyContribution;
    }
    const fromPremium = parseAmountLoose(row.premiumAmount);
    if (fromPremium > 0) return fromPremium;
    return intended;
  }

  if (intended > 0) return intended;
  const annual = parseAmountLoose(row.premiumAnnual);
  if (annual > 0) return annual;
  const monthly = p.premiumMonthly ?? parseAmountLoose(row.premiumAmount);
  return monthly > 0 ? monthly * 12 : 0;
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
    if (INVEST_SEGMENTS.has(seg)) {
      monthlyInvest += monthlyCashflowForKpi(p);
      personalAum += investmentAumForRow(c, p);
    } else if (INSURANCE_SEGMENTS.has(seg)) {
      monthlyInsurance += monthlyCashflowForKpi(p);
      annualInsurance += annualInsuranceAmountForKpi(p);
    }
  }

  return { monthlyInvest, personalAum, monthlyInsurance, annualInsurance };
}
