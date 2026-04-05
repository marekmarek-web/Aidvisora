import { BATCH_A_BASE_FUNDS } from "./base-funds-batch-a";
import { BATCH_B_BASE_FUNDS } from "./base-funds-batch-b";
import { BATCH_C_BASE_FUNDS } from "./base-funds-batch-c";
import { BATCH_D_BASE_FUNDS } from "./base-funds-batch-d";
import type { BaseFund } from "./types";

/**
 * Katalog base fondů: Batch A–D (reálná data). Placeholdery po Batch D nejsou.
 */
export const BASE_FUNDS: readonly BaseFund[] = [
  ...BATCH_A_BASE_FUNDS,
  ...BATCH_B_BASE_FUNDS,
  ...BATCH_C_BASE_FUNDS,
  ...BATCH_D_BASE_FUNDS,
];
