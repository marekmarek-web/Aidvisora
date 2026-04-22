/**
 * Společné mapování `BatchASeedRow` → `BaseFund` pro Batch A / B (jedno schéma seedu).
 */

import type { BatchASeedRow } from "./base-funds-batch-a.seed";
import type { BaseFundKey } from "./legacy-fund-key-map";
import { normalizeFundAssetsFromSeed } from "./fund-report-asset-resolver";
import {
  DEFAULT_FUND_AVAILABILITY,
  type BaseFund,
  type FundAvailabilityTag,
  type FundSource,
} from "./types";

function mapSources(sources: BatchASeedRow["sources"]): FundSource[] {
  return sources.map((s) => ({
    kind: s.kind,
    label: s.label,
    url: s.url,
  }));
}

export function mapBatchSeedRowToBaseFund(
  row: BatchASeedRow,
  allowedKeys: ReadonlySet<BaseFundKey>,
  availability: readonly FundAvailabilityTag[] = DEFAULT_FUND_AVAILABILITY,
): BaseFund {
  const key = row.baseFundKey as BaseFundKey;
  if (!allowedKeys.has(key)) {
    throw new Error(`mapBatchSeedRowToBaseFund: unexpected baseFundKey ${row.baseFundKey}`);
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
    availability,
    sources: mapSources(row.sources),
    assets: normalizeFundAssetsFromSeed({
      logo: row.logo,
      heroImage: row.heroImage,
      galleryImages: row.galleryImages,
      galleryType: row.galleryType,
    }),
    assetTodo: row.assetTodo,
    notes: row.notes,
    performance: null,
  };
}
