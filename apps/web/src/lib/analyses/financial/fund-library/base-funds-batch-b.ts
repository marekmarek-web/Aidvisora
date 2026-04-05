import { BATCH_B_SEED_ROWS } from "./base-funds-batch-b.seed";
import { mapBatchSeedRowToBaseFund } from "./base-funds-seed-map";
import type { BatchASeedRow } from "./base-funds-batch-a.seed";
import type { BaseFundKey } from "./legacy-fund-key-map";
import type { BaseFund } from "./types";

const BATCH_B_KEYS = new Set<BaseFundKey>([
  "fidelity_target_2040",
  "investika_realitni_fond",
  "monetika",
  "efektika",
]);

export function mapBatchBSeedRowToBaseFund(row: BatchASeedRow): BaseFund {
  return mapBatchSeedRowToBaseFund(row, BATCH_B_KEYS);
}

/** Čtyři fondy Batch B — reálná data ze `base-funds-batch-b.seed.ts`. */
export const BATCH_B_BASE_FUNDS: BaseFund[] = BATCH_B_SEED_ROWS.map(mapBatchBSeedRowToBaseFund);
