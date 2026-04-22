"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/permissions";
import { db, paymentAccounts, eq, and, isNull } from "db";

/**
 * Institucionální defaultní platební účet (globální, tenant-free).
 * Zdrojová data jsou seedována z `packages/db/src/data/institution-payment-accounts-v1.json`
 * migrací `payment-accounts-institutional-defaults-2026-04-22.sql`. Tenant si
 * může globální default přepsat vlastním řádkem v `payment_accounts`, v tom
 * případě tato funkce vrátí tenant override.
 *
 * Resolution:
 *   1) Tenant override (tenant_id = auth.tenantId) — nejdřív přesný match
 *      (partner + segment + paymentType + productCode), postupně fallback na
 *      generičtější řádky až na (partner + segment).
 *   2) Globální default (tenant_id IS NULL) — stejná fallback strategie.
 *   3) `alternatives` — další řádky pro (partner + segment) v globálu, které
 *      se nepoužily jako primární match (jiný paymentType nebo productCode).
 *      UI je zobrazí jako hint, když existují různé účty podle typu platby nebo produktu.
 */
export type InstitutionDefaultAccount = {
  accountNumber: string | null;
  bank: string | null;
  bankCode: string | null;
  /** Pokud je vyplněno, `accountNumber` se vygeneruje z této šablony — viz `renderInstitutionalAccountTemplate`. */
  accountNumberTemplate: string | null;
  variableSymbolRequired: boolean;
  /** Defaultní konstantní symbol (např. „558" Conseq účastník, „3552" Conseq zaměstnavatel, „3558" ČSOB PS). */
  constantSymbol: string | null;
  /** Šablona pro specifický symbol: literál („99") nebo placeholder ({birthNumber}, {ico}, {yearMonth}). */
  specificSymbolTemplate: string | null;
  /** Textový popis pravidel pro symboly — tooltip v UI. */
  symbolRulesNote: string | null;
  note: string | null;
  paymentType: string | null;
  productCode: string | null;
  /** Od jakého řádku to přišlo (tenant override vs global) — pro audit a UI. */
  scope: "tenant" | "global";
  /** Alternativní účty pro stejnou (partner, segment) — liší se paymentType/productCode. */
  alternatives: InstitutionDefaultAlternative[];
};

export type InstitutionDefaultAlternative = {
  paymentType: string | null;
  productCode: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  accountNumberTemplate: string | null;
  constantSymbol: string | null;
  specificSymbolTemplate: string | null;
  note: string | null;
};

export type InstitutionDefaultLookupOpts = {
  /** 'regular' | 'first' | 'extra' | 'employer' — default 'regular'. */
  paymentType?: string | null;
  /** Např. 'active_horizont_invest' vs 'classic_invest_czk' u Consequ. */
  productCode?: string | null;
};

function normalizeProviderName(value: string): string {
  return value.trim().toLowerCase();
}

type PaymentAccountRow = {
  partnerName: string | null;
  segment: string;
  paymentType: string | null;
  productCode: string | null;
  accountNumber: string | null;
  bank: string | null;
  bankCode: string | null;
  accountNumberTemplate: string | null;
  variableSymbolRequired: boolean;
  constantSymbol: string | null;
  specificSymbolTemplate: string | null;
  symbolRulesNote: string | null;
  note: string | null;
};

/**
 * Score kandidáta: čím vyšší, tím přesnější match.
 *   +4 productCode přesně sedí (nebo oba NULL)
 *   +2 paymentType přesně sedí (nebo oba NULL)
 *   +1 productCode NULL v řádku, ale uživatel o produkt nežádal (generický default)
 *   +1 paymentType NULL v řádku + uživatel žádá 'regular' (generický ≈ regular)
 */
function scoreCandidate(
  row: PaymentAccountRow,
  wantedPaymentType: string,
  wantedProductCode: string | null,
): number {
  let score = 0;
  if (row.productCode === wantedProductCode) {
    score += 4;
  } else if (row.productCode == null) {
    if (wantedProductCode == null) score += 4;
    else score += 1;
  } else {
    return -1;
  }

  if (row.paymentType === wantedPaymentType) {
    score += 2;
  } else if (row.paymentType == null) {
    score += wantedPaymentType === "regular" ? 2 : 1;
  } else {
    return -1;
  }

  return score;
}

function pickBest(
  rows: PaymentAccountRow[],
  paymentType: string,
  productCode: string | null,
): PaymentAccountRow | null {
  let best: PaymentAccountRow | null = null;
  let bestScore = -1;
  for (const r of rows) {
    const s = scoreCandidate(r, paymentType, productCode);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return bestScore >= 0 ? best : null;
}

function toAlternative(row: PaymentAccountRow): InstitutionDefaultAlternative {
  return {
    paymentType: row.paymentType,
    productCode: row.productCode,
    accountNumber: emptyToNull(row.accountNumber),
    bankCode: row.bankCode,
    accountNumberTemplate: row.accountNumberTemplate,
    constantSymbol: row.constantSymbol,
    specificSymbolTemplate: row.specificSymbolTemplate,
    note: row.note,
  };
}

/**
 * Pro danou instituci (`providerName`), segment a volitelné dimenze paymentType/productCode
 * vrátí defaultní platební účet s případnými alternativami.
 * Priorita:
 *   1) Tenant override (match na tuple + fallback na generičtější).
 *   2) Globální default (stejná logika).
 *   3) `null` — žádný default, UI ponechá pole prázdná.
 */
export async function getInstitutionDefaultAccount(
  providerName: string,
  segment: string,
  opts: InstitutionDefaultLookupOpts = {},
): Promise<InstitutionDefaultAccount | null> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:read")) {
    return null;
  }

  const normalized = normalizeProviderName(providerName);
  if (!normalized || !segment) return null;

  const paymentType = opts.paymentType ?? "regular";
  const productCode = opts.productCode ?? null;

  const tenantRows = (
    await db
      .select()
      .from(paymentAccounts)
      .where(and(eq(paymentAccounts.tenantId, auth.tenantId), eq(paymentAccounts.segment, segment)))
  ).filter((r) => r.partnerName && normalizeProviderName(r.partnerName) === normalized);

  const tenantPick = pickBest(tenantRows, paymentType, productCode);
  if (tenantPick) {
    const alternatives = tenantRows.filter((r) => r !== tenantPick).map(toAlternative);
    return buildResult(tenantPick, "tenant", alternatives);
  }

  const globalRows = (
    await db
      .select()
      .from(paymentAccounts)
      .where(and(isNull(paymentAccounts.tenantId), eq(paymentAccounts.segment, segment)))
  ).filter((r) => r.partnerName && normalizeProviderName(r.partnerName) === normalized);

  const globalPick = pickBest(globalRows, paymentType, productCode);
  if (!globalPick) return null;

  const alternatives = globalRows.filter((r) => r !== globalPick).map(toAlternative);
  return buildResult(globalPick, "global", alternatives);
}

function buildResult(
  row: PaymentAccountRow,
  scope: "tenant" | "global",
  alternatives: InstitutionDefaultAlternative[],
): InstitutionDefaultAccount {
  return {
    accountNumber: emptyToNull(row.accountNumber),
    bank: row.bank,
    bankCode: row.bankCode,
    accountNumberTemplate: row.accountNumberTemplate,
    variableSymbolRequired: row.variableSymbolRequired,
    constantSymbol: row.constantSymbol,
    specificSymbolTemplate: row.specificSymbolTemplate,
    symbolRulesNote: row.symbolRulesNote,
    note: row.note,
    paymentType: row.paymentType,
    productCode: row.productCode,
    scope,
    alternatives,
  };
}

function emptyToNull(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
