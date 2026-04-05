import type { FundVariant } from "./types";

/**
 * Varianty nad stejným base fondem (standard / DIP / ZAL / ZAL+DIP).
 * Zatím jen u Conseq DPS — bez business pravidel, čistě datový model.
 */
export const FUND_VARIANTS: readonly FundVariant[] = [
  {
    baseFundKey: "conseq_globalni_akciovy_ucastnicky",
    variantKey: "standard",
    isActive: true,
  },
  {
    baseFundKey: "conseq_globalni_akciovy_ucastnicky",
    variantKey: "dip",
    displayNameSuffix: "DIP",
    isActive: true,
  },
  {
    baseFundKey: "conseq_globalni_akciovy_ucastnicky",
    variantKey: "zal",
    displayNameSuffix: "ZAL",
    isActive: true,
  },
  {
    baseFundKey: "conseq_globalni_akciovy_ucastnicky",
    variantKey: "zal_dip",
    displayNameSuffix: "ZAL + DIP",
    isActive: true,
  },
];
