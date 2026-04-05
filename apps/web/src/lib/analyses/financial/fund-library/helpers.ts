import { BASE_FUNDS } from "./base-funds";
export { BATCH_A_BASE_FUNDS, mapBatchASeedRowToBaseFund } from "./base-funds-batch-a";
export { BATCH_A_SEED_ROWS } from "./base-funds-batch-a.seed";
import { FUND_VARIANTS } from "./fund-variants";
import {
  mapLegacyFundKey as mapLegacyFundKeyInner,
  type BaseFundKey,
} from "./legacy-fund-key-map";
import type { BaseFund, FundVariant, FundVariantKey } from "./types";

export { mapLegacyFundKeyInner as mapLegacyFundKey };

const baseByKey: ReadonlyMap<BaseFundKey, BaseFund> = new Map(
  BASE_FUNDS.map((f) => [f.baseFundKey, f]),
);

export function getBaseFundByKey(key: BaseFundKey): BaseFund | undefined {
  return baseByKey.get(key);
}

export function getBaseFundsList(options?: { includeInactive?: boolean }): BaseFund[] {
  const list = options?.includeInactive ? [...BASE_FUNDS] : BASE_FUNDS.filter((f) => f.isActive);
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName, "cs"));
}

export function getVariantByKey(
  baseFundKey: BaseFundKey,
  variantKey: FundVariantKey,
): FundVariant | undefined {
  return FUND_VARIANTS.find(
    (v) => v.baseFundKey === baseFundKey && v.variantKey === variantKey && v.isActive,
  );
}

export function getVariantsForBaseFund(
  baseFundKey: BaseFundKey,
  options?: { includeInactive?: boolean },
): FundVariant[] {
  return FUND_VARIANTS.filter(
    (v) =>
      v.baseFundKey === baseFundKey && (options?.includeInactive ? true : v.isActive),
  );
}

/**
 * Cesta k logu z katalogu. Prázdný řetězec = žádný soubor (UI může zobrazit iniciály).
 * Neprovádí kontrolu existence souboru — build zůstane validní i bez assetů.
 */
export function resolveFundLogoPath(fund: BaseFund): string {
  return (fund.assets.logoPath ?? "").trim();
}
