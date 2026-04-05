import {
  BATCH_A_SEED_ROWS,
  type BatchASeedRow,
} from "./base-funds-batch-a.seed";
import type { BaseFundKey } from "./legacy-fund-key-map";
import type { BaseFund, FundSource } from "./types";

const BATCH_A_KEYS = new Set<BaseFundKey>([
  "ishares_core_msci_world",
  "ishares_core_sp_500",
  "vanguard_ftse_emerging_markets",
  "ishares_core_global_aggregate_bond",
]);

function mapSources(sources: BatchASeedRow["sources"]): FundSource[] {
  return sources.map((s) => ({
    kind: s.kind,
    label: s.label,
    url: s.url,
  }));
}

/**
 * Převod řádku Batch A seedu na katalogový `BaseFund`.
 * Žádná nová fakta — jen strukturované přenesení ze seed souboru.
 */
export function mapBatchASeedRowToBaseFund(row: BatchASeedRow): BaseFund {
  const key = row.baseFundKey as BaseFundKey;
  if (!BATCH_A_KEYS.has(key)) {
    throw new Error(`base-funds-batch-a: unexpected baseFundKey ${row.baseFundKey}`);
  }

  return {
    baseFundKey: key,
    canonicalName: row.canonicalName,
    displayName: row.displayName,
    provider: row.provider,
    manager: row.manager,
    category: row.category,
    subcategory: row.subcategory,
    currency: row.currency,
    isin: row.isin,
    ticker: row.ticker,
    riskSRI: row.riskSRI,
    goal: row.goal,
    strategy: row.strategy,
    description: row.description,
    suitable: row.suitable,
    horizon: row.horizon,
    liquidity: row.liquidity,
    risks: row.risks,
    minInvestment: row.minInvestment ?? null,
    planningRate: row.planningRate,
    officialPerformance: row.officialPerformance ?? null,
    benefits: row.benefits,
    parameters: row.parameters,
    topHoldings: row.topHoldings,
    countries: row.countries,
    sectors: row.sectors,
    morningstarRating: row.morningstarRating,
    awards: row.awards,
    factsheetUrl: row.factsheetUrl,
    factsheetAsOf: row.factsheetAsOf,
    verifiedAt: row.verifiedAt,
    isActive: true,
    sources: mapSources(row.sources),
    assets: {
      logoPath: row.logo,
      heroPath: row.heroImage,
      galleryPaths: row.galleryImages,
    },
    assetTodo: row.assetTodo,
    notes: row.notes,
    performance: null,
  };
}

/** Čtyři fondy Batch A — reálná data ze `base-funds-batch-a.seed.ts`. */
export const BATCH_A_BASE_FUNDS: BaseFund[] = BATCH_A_SEED_ROWS.map(mapBatchASeedRowToBaseFund);
