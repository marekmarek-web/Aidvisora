/**
 * Fondová knihovna — typy oddělené od legacy `FundDetail` v financial/types.
 * Fakta a performance mohou být postupně doplňována (nullable / optional).
 */

import type { BaseFundKey } from "./legacy-fund-key-map";

export type FundSourceType = "factsheet" | "morningstar" | "internal";

export interface FundSource {
  type: FundSourceType;
  label: string;
  url?: string;
}

export interface FundAssetPack {
  logoPath?: string;
  heroPath?: string;
  galleryPaths?: string[];
}

/** Snímek výkonnosti — nemusí být pro všechny fondy vyplněný. */
export interface FundPerformanceSnapshot {
  asOfDate: string;
  return1Y?: number | null;
  return3Y?: number | null;
  return5Y?: number | null;
  morningstarRating?: number | null;
  awards?: string | null;
}

export type FundVariantKey = "standard" | "dip" | "zal" | "zal_dip";

export interface BaseFund {
  baseFundKey: BaseFundKey;
  displayName: string;
  provider: string;
  category: string;
  isActive: boolean;
  sources: FundSource[];
  assets: FundAssetPack;
  /** Poznámka pro editory / budoucí factsheet napojení */
  notes?: string;
  performance?: FundPerformanceSnapshot | null;
}

export interface FundVariant {
  baseFundKey: BaseFundKey;
  variantKey: FundVariantKey;
  displayNameSuffix?: string;
  isActive: boolean;
}
