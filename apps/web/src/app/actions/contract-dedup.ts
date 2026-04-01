"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getContractsByContact } from "./contracts";
import type { ContractRow } from "./contracts";

export type DuplicateContractPair = {
  contractA: ContractRow;
  contractB: ContractRow;
  reason: "same_contract_number" | "same_partner_product";
};

function normCn(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Heuristic duplicate detection for advisor review (not automatic merge).
 */
export async function getPotentialDuplicateContractPairs(contactId: string): Promise<DuplicateContractPair[]> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:read")) throw new Error("Forbidden");

  const rows = await getContractsByContact(contactId);
  const pairs: DuplicateContractPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const key = [a.id, b.id].sort().join(":");
      if (seen.has(key)) continue;

      const cnA = normCn(a.contractNumber);
      const cnB = normCn(b.contractNumber);
      if (cnA && cnB && cnA === cnB) {
        seen.add(key);
        pairs.push({ contractA: a, contractB: b, reason: "same_contract_number" });
        continue;
      }

      const pA = (a.partnerName ?? "").trim().toLowerCase();
      const pB = (b.partnerName ?? "").trim().toLowerCase();
      const prA = (a.productName ?? "").trim().toLowerCase();
      const prB = (b.productName ?? "").trim().toLowerCase();
      if (pA && pB && prA && prB && pA === pB && prA === prB && a.segment === b.segment) {
        seen.add(key);
        pairs.push({ contractA: a, contractB: b, reason: "same_partner_product" });
      }
    }
  }

  return pairs;
}
