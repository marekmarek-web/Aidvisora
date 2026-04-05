import { BATCH_A_SEED_ROWS, type BatchASeedRow } from "./base-funds-batch-a.seed";
import { mapBatchSeedRowToBaseFund } from "./base-funds-seed-map";
import type { BaseFundKey } from "./legacy-fund-key-map";
import type { BaseFund } from "./types";

const BATCH_A_KEYS = new Set<BaseFundKey>([
  "ishares_core_msci_world",
  "ishares_core_sp_500",
  "vanguard_ftse_emerging_markets",
  "ishares_core_global_aggregate_bond",
]);

/**
 * Převod řádku Batch A seedu na katalogový `BaseFund`.
 * Žádná nová fakta — jen strukturované přenesení ze seed souboru.
 */
export function mapBatchASeedRowToBaseFund(row: BatchASeedRow): BaseFund {
  return mapBatchSeedRowToBaseFund(row, BATCH_A_KEYS);
}

/** Čtyři fondy Batch A — reálná data ze `base-funds-batch-a.seed.ts`. */
export const BATCH_A_BASE_FUNDS: BaseFund[] = BATCH_A_SEED_ROWS.map(mapBatchASeedRowToBaseFund);
