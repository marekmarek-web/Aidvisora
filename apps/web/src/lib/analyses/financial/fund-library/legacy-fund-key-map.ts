/**
 * Canonical base fund keys (v1) a mapa legacy `productKey` → canonical.
 * World ETF je výhradně iShares Core MSCI World.
 * alternative / AlgoImperial / imperial: removed legacy (viz REMOVED_LEGACY_KEYS).
 */

export const BASE_FUND_KEYS = [
  "ishares_core_msci_world",
  "ishares_core_sp_500",
  "vanguard_ftse_emerging_markets",
  "ishares_core_global_aggregate_bond",
  "fidelity_target_2040",
  "investika_realitni_fond",
  "monetika",
  "efektika",
  "conseq_globalni_akciovy_ucastnicky",
  "nn_povinny_konzervativni",
  "nn_vyvazeny",
  "nn_rustovy",
  "creif",
  "atris",
  "penta",
] as const;

export type BaseFundKey = (typeof BASE_FUND_KEYS)[number];

const BASE_FUND_KEY_SET: ReadonlySet<string> = new Set(BASE_FUND_KEYS);

/**
 * Normalizace vstupu z UI / JSON (mezery → podtržítko, lower case).
 * Např. `World ETF` → `world_etf` → `ishares_core_msci_world`.
 */
export function normalizeLegacyFundKeyInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Legacy nebo alias klíč → canonical base (jen mapovatelné; removed řeší samostatně). */
export const LEGACY_FUND_KEY_TO_CANONICAL: Readonly<Record<string, BaseFundKey>> = {
  ishares: "ishares_core_msci_world",
  world_etf: "ishares_core_msci_world",
  msci_world: "ishares_core_msci_world",
  fidelity2040: "fidelity_target_2040",
  conseq: "conseq_globalni_akciovy_ucastnicky",
  creif: "creif",
  atris: "atris",
  /** Jeden kanonický fond Realita — starší aliasy z dokumentace / seedů */
  atris_realita: "atris",
  realita: "atris",
  penta: "penta",
  penta_real_estate_fund: "penta",
  penta_real_estate: "penta",
};

/** Odstraněné produkty — žádný canonical cíl. */
export const REMOVED_LEGACY_KEYS = new Set(
  [
    "alternative",
    "algoimperial",
    "imperial",
    "algo_imperial",
  ].map((k) => k.toLowerCase()),
);

export function isCanonicalBaseFundKey(value: string): value is BaseFundKey {
  return BASE_FUND_KEY_SET.has(value);
}

export function isRemovedLegacyFundKey(raw: string): boolean {
  return REMOVED_LEGACY_KEYS.has(normalizeLegacyFundKeyInput(raw));
}

/**
 * Převod uloženého / UI klíče na canonical base fund key.
 * @returns null pro odstraněné klíče (`alternative`, AlgoImperial, …) i pro neznámý řetězec — bez výjimky.
 */
export function mapLegacyFundKey(raw: string): BaseFundKey | null {
  const key = normalizeLegacyFundKeyInput(raw);
  if (REMOVED_LEGACY_KEYS.has(key)) return null;
  const mapped = LEGACY_FUND_KEY_TO_CANONICAL[key];
  if (mapped) return mapped;
  if (isCanonicalBaseFundKey(key)) return key;
  return null;
}
