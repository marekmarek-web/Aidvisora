/**
 * Normalise persisted investment rows (personal FA + company FA import).
 * Kept separate from saveLoad so server actions can import without the full persistence graph.
 */

import type { InvestmentEntry } from "./types";
import { mapLegacyFundKey } from "./fund-library/legacy-fund-key-map";

/** Legacy / odstraněné klíče vyhodí; známé aliasy převede na kanonický BaseFundKey. */
export function normalizePersistedInvestmentEntries(rows: InvestmentEntry[]): InvestmentEntry[] {
  const out: InvestmentEntry[] = [];
  for (const inv of rows) {
    const c = mapLegacyFundKey(inv.productKey);
    if (!c) continue;
    out.push({ ...inv, productKey: c });
  }
  return out;
}
