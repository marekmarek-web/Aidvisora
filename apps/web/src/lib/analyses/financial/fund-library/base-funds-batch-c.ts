import { BATCH_C_SEED_ROWS } from "./base-funds-batch-c.seed";
import { mapBatchSeedRowToBaseFund } from "./base-funds-seed-map";
import type { BatchASeedRow } from "./base-funds-batch-a.seed";
import type { BaseFundKey } from "./legacy-fund-key-map";
import { PENSION_FUND_AVAILABILITY, type BaseFund } from "./types";

const BATCH_C_KEYS = new Set<BaseFundKey>([
  "conseq_globalni_akciovy_ucastnicky",
  "nn_povinny_konzervativni",
  "nn_vyvazeny",
  "nn_rustovy",
]);

export function mapBatchCSeedRowToBaseFund(row: BatchASeedRow): BaseFund {
  return mapBatchSeedRowToBaseFund(row, BATCH_C_KEYS, PENSION_FUND_AVAILABILITY);
}

/** Čtyři fondy Batch C — penzijní účastnické fondy (`PENSION_FUND_AVAILABILITY` včetně tagu `pension`). */
export const BATCH_C_BASE_FUNDS: BaseFund[] = BATCH_C_SEED_ROWS.map(mapBatchCSeedRowToBaseFund);
