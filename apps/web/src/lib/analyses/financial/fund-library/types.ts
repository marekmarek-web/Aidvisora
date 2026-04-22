/**
 * Fondová knihovna — typy oddělené od legacy `FundDetail` v financial/types.
 * Fakta a performance mohou být postupně doplňována (nullable / optional).
 */

import type { BaseFundKey } from "./legacy-fund-key-map";

/** Oficiální výkonnost z factsheetu (řetězce tak, jak je zdroj uvádí). */
export interface OfficialFundPerformance {
  ytd?: string | null;
  oneYear?: string | null;
  threeYearPA?: string | null;
  fiveYearPA?: string | null;
  tenYearPA?: string | null;
  sinceInceptionPA?: string | null;
  asOf?: string | null;
}

export type FundSourceKind =
  | "factsheet"
  | "morningstar"
  | "internal"
  | "landing_page"
  | "kid"
  | "report"
  | "documents";

export interface FundSource {
  kind: FundSourceKind;
  label: string;
  url?: string;
}

export interface FundAssetPack {
  logoPath?: string;
  heroPath?: string;
  galleryPaths?: string[];
  /** Jak zobrazit galerii v reportu — `"logo"` = značky/partneři (bílé pozadí, padding). */
  galleryType?: "photo" | "logo";
}

/** Numerický snímek (volitelný; Batch A používá spíše officialPerformance). */
export interface FundPerformanceSnapshot {
  asOfDate: string;
  return1Y?: number | null;
  return3Y?: number | null;
  return5Y?: number | null;
  morningstarRating?: number | null;
  awards?: string | null;
}

export type FundVariantKey = "standard" | "dip" | "zal" | "zal_dip";

/**
 * Kde má smysl fond v aplikaci nabízet (datová vrstva; wizard/report zatím na legacy).
 * Další batchy mohou zužovat např. jen `report` pro čistě katalogové záznamy.
 */
export type FundAvailabilityTag =
  | "personal_fa"
  | "company_fa"
  | "report"
  | "pension"
  | "qualified_investor";

export const DEFAULT_FUND_AVAILABILITY: readonly FundAvailabilityTag[] = [
  "personal_fa",
  "company_fa",
  "report",
];

/** Doplňkové penzijní účastnické fondy — stejné kontexty jako default + tag pro filtrování „jen DPS“. */
export const PENSION_FUND_AVAILABILITY: readonly FundAvailabilityTag[] = [
  "personal_fa",
  "company_fa",
  "report",
  "pension",
];

/** Fond kvalifikovaných investorů — filtr `getFundsByAvailability("qualified_investor")` + oddělení v UI skupinách. */
export const QUALIFIED_INVESTOR_FUND_AVAILABILITY: readonly FundAvailabilityTag[] = [
  "personal_fa",
  "company_fa",
  "report",
  "qualified_investor",
];

/**
 * Záznam v centrálním katalogu (single source of truth pro metadata).
 * Legacy `InvestmentEntry.productKey` zůstává string — mapuje se přes `mapLegacyFundKey`.
 */
export interface BaseFund {
  baseFundKey: BaseFundKey;
  /** Oficiální název produktu / třídy podílů */
  canonicalName?: string;
  displayName: string;
  provider: string;
  manager?: string;
  category: string;
  subcategory?: string;
  currency?: string;
  isin?: string | null;
  ticker?: string | null;
  riskSRI?: number | null;
  goal?: string;
  strategy?: string;
  description?: string;
  suitable?: string;
  horizon?: string;
  liquidity?: string;
  risks?: string;
  minInvestment?: string | null;
  /**
   * Interní modelový předpoklad (% p.a. jako číslo, např. 8 = 8 %).
   * Není oficiální výkonnost — viz officialPerformance.
   */
  planningRate?: number | null;
  officialPerformance?: OfficialFundPerformance | null;
  benefits?: string[];
  parameters?: Record<string, string>;
  /** Řádky z factsheetu, např. "NVIDIA 5.04%" */
  topHoldings?: string[];
  countries?: string[];
  sectors?: string[];
  morningstarRating?: string | null;
  awards?: string[];
  factsheetUrl?: string | null;
  factsheetAsOf?: string | null;
  verifiedAt?: string | null;
  isActive: boolean;
  /** Kontexty nabídky fondu (filtrování bez zásahu do UI). */
  availability: readonly FundAvailabilityTag[];
  sources: FundSource[];
  assets: FundAssetPack;
  /** Chybějící vizuály k doplnění do asset knihovny */
  assetTodo?: string[];
  /** Provozní / editorské poznámky */
  notes?: string[];
  performance?: FundPerformanceSnapshot | null;
}

/**
 * Varianta nad jedním `baseFundKey` (DIP / ZAL / …) — odděleně od base záznamu v katalogu.
 */
export interface FundVariant {
  baseFundKey: BaseFundKey;
  variantKey: FundVariantKey;
  displayNameSuffix?: string;
  isActive: boolean;
}
