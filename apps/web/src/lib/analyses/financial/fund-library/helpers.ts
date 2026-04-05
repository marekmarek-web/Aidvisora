import { BASE_FUNDS } from "./base-funds";
export { BATCH_A_BASE_FUNDS, mapBatchASeedRowToBaseFund } from "./base-funds-batch-a";
export { BATCH_A_SEED_ROWS } from "./base-funds-batch-a.seed";
import { FUND_VARIANTS } from "./fund-variants";
import { mapLegacyFundKey, type BaseFundKey } from "./legacy-fund-key-map";
import type {
  BaseFund,
  FundAvailabilityTag,
  FundVariant,
  FundVariantKey,
} from "./types";

const baseByKey: ReadonlyMap<BaseFundKey, BaseFund> = new Map(
  BASE_FUNDS.map((f) => [f.baseFundKey, f]),
);

export function getBaseFundByKey(key: BaseFundKey): BaseFund | undefined {
  return baseByKey.get(key);
}

/**
 * Lookup z uloženého nebo UI `productKey` (legacy i canonical).
 * Odstraněné klíče (`alternative`, AlgoImperial, …) → undefined (žádná výjimka).
 */
export function getBaseFundFromProductKey(raw: string | null | undefined): BaseFund | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const canonical = mapLegacyFundKey(s);
  if (!canonical) return undefined;
  return baseByKey.get(canonical);
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

/** Stejné jako `getVariantByKey` — jednotný název pro veřejné API knihovny. */
export const getFundVariantByKey = getVariantByKey;

export function getVariantsForBaseFund(
  baseFundKey: BaseFundKey,
  options?: { includeInactive?: boolean },
): FundVariant[] {
  return FUND_VARIANTS.filter(
    (v) =>
      v.baseFundKey === baseFundKey && (options?.includeInactive ? true : v.isActive),
  );
}

export function getFundsByCategory(
  category: string,
  options?: { includeInactive?: boolean; exact?: boolean },
): BaseFund[] {
  const q = category.trim().toLowerCase();
  const list = getBaseFundsList(options);
  if (!q) return list;
  return list.filter((f) => {
    const c = f.category.trim().toLowerCase();
    return options?.exact === false ? c.includes(q) : c === q;
  });
}

export function getFundsByAvailability(
  tag: FundAvailabilityTag,
  options?: { includeInactive?: boolean },
): BaseFund[] {
  return getBaseFundsList(options).filter((f) => f.availability.includes(tag));
}

/**
 * Cesta k logu z katalogu. Prázdný řetězec = žádný soubor (UI může zobrazit iniciály).
 */
export function resolveFundLogoPath(fund: BaseFund): string {
  return (fund.assets.logoPath ?? "").trim();
}
