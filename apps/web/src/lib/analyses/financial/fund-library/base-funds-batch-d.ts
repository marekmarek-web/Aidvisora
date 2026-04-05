import { BATCH_D_SEED_ROWS } from "./base-funds-batch-d.seed";
import { mapBatchSeedRowToBaseFund } from "./base-funds-seed-map";
import type { BatchASeedRow } from "./base-funds-batch-a.seed";
import type { BaseFundKey } from "./legacy-fund-key-map";
import {
  DEFAULT_FUND_AVAILABILITY,
  QUALIFIED_INVESTOR_FUND_AVAILABILITY,
  type BaseFund,
} from "./types";

const BATCH_D_KEYS = new Set<BaseFundKey>(["creif", "atris", "penta"]);

export function mapBatchDSeedRowToBaseFund(row: BatchASeedRow): BaseFund {
  const availability =
    row.baseFundKey === "penta" ? QUALIFIED_INVESTOR_FUND_AVAILABILITY : DEFAULT_FUND_AVAILABILITY;
  return mapBatchSeedRowToBaseFund(row, BATCH_D_KEYS, availability);
}

/** CREIF, ATRIS, Penta (FKI) — Penta má `qualified_investor` v availability. */
export const BATCH_D_BASE_FUNDS: BaseFund[] = BATCH_D_SEED_ROWS.map(mapBatchDSeedRowToBaseFund);
