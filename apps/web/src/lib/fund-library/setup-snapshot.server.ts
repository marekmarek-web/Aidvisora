import "server-only";

import { unstable_cache } from "next/cache";
import { tenantSettings, advisorPreferences, fundAddRequests, eq, and, desc } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { BASE_FUNDS } from "@/lib/analyses/financial/fund-library/base-funds";
import { BASE_FUND_KEYS, type BaseFundKey } from "@/lib/analyses/financial/fund-library/legacy-fund-key-map";
import type { RoleName } from "@/shared/rolePermissions";
import { isRoleAtLeast } from "@/shared/rolePermissions";
import {
  TENANT_ALLOWLIST_KEY,
  type TenantFundAllowlistValue,
  type AdvisorFundLibraryValue,
  type FundCatalogListItemDTO,
  type FundAddRequestQueueRow,
  type FundAddRequestQueueStatus,
  type FundLibrarySetupSnapshot,
} from "@/lib/fund-library/fund-library-setup-types";

export type {
  TenantFundAllowlistValue,
  AdvisorFundLibraryValue,
  FundCatalogListItemDTO,
  FundLibrarySetupSnapshot,
} from "@/lib/fund-library/fund-library-setup-types";

const CATALOG_ORDER = [...BASE_FUND_KEYS] as string[];

function isValidBaseFundKey(k: string): k is BaseFundKey {
  return (BASE_FUND_KEYS as readonly string[]).includes(k);
}

function normalizeQueueStatus(raw: string): FundAddRequestQueueStatus {
  const legacy: Record<string, FundAddRequestQueueStatus> = {
    under_review: "in_progress",
    approved: "added",
    need_info: "new",
  };
  const mapped = legacy[raw];
  if (mapped) return mapped;
  if (raw === "new" || raw === "in_progress" || raw === "added" || raw === "rejected") return raw;
  return "new";
}

function mergeAdvisorPrefs(
  raw: AdvisorFundLibraryValue | null | undefined,
  allowedKeys: string[],
): AdvisorFundLibraryValue {
  const allowedSet = new Set(allowedKeys);
  const storedOrder = (raw?.order ?? []).filter((k) => allowedSet.has(k));
  const missing = allowedKeys.filter((k) => !storedOrder.includes(k));
  const order = [...storedOrder, ...missing];
  const enabled: Record<string, boolean> = {};
  for (const k of order) {
    enabled[k] = raw?.enabled?.[k] !== false;
  }
  return { order, enabled };
}

/**
 * Snapshot pro FA + Nastavení. Chybějící řádek tenant allowlist = všechny fondy z katalogu.
 * Chybějící advisor řádek = default merge (všechna povolená, zapnuté).
 */
async function fetchTenantAllowlist(tenantId: string) {
  const [tenantRow] = await withTenantContext({ tenantId }, (tx) =>
    tx
      .select({ value: tenantSettings.value })
      .from(tenantSettings)
      .where(and(eq(tenantSettings.tenantId, tenantId), eq(tenantSettings.key, TENANT_ALLOWLIST_KEY)))
      .limit(1),
  );
  return (tenantRow?.value ?? null) as TenantFundAllowlistValue | null;
}

async function fetchAdvisorFundPrefs(tenantId: string, userId: string) {
  const [prefRow] = await withTenantContext({ tenantId, userId }, (tx) =>
    tx
      .select({ fundLibrary: advisorPreferences.fundLibrary })
      .from(advisorPreferences)
      .where(and(eq(advisorPreferences.tenantId, tenantId), eq(advisorPreferences.userId, userId)))
      .limit(1),
  );
  return prefRow?.fundLibrary ?? null;
}

export function getFundLibraryCacheTag(tenantId: string) {
  return `fund-library-${tenantId}`;
}
export function getFundLibraryAdvisorCacheTag(tenantId: string, userId: string) {
  return `fund-library-advisor-${tenantId}-${userId}`;
}

export async function getFundLibrarySetupSnapshot(
  tenantId: string,
  userId: string,
  roleName: RoleName,
): Promise<FundLibrarySetupSnapshot> {
  const canEditTenantAllowlist = isRoleAtLeast(roleName, "Director");

  const cachedAllowlist = unstable_cache(
    () => fetchTenantAllowlist(tenantId),
    [`fund-allowlist-${tenantId}`],
    { revalidate: 60, tags: [getFundLibraryCacheTag(tenantId)] }
  );
  const cachedAdvisorPrefs = unstable_cache(
    () => fetchAdvisorFundPrefs(tenantId, userId),
    [`fund-advisor-prefs-${tenantId}-${userId}`],
    { revalidate: 60, tags: [getFundLibraryAdvisorCacheTag(tenantId, userId)] }
  );

  const [rawAllow, rawFundLibrary] = await Promise.all([
    cachedAllowlist(),
    cachedAdvisorPrefs(),
  ]);

  const rawList = rawAllow?.allowedBaseFundKeys;
  /** undefined / missing row = všechny; explicitní pole (i prázdné) = jen vyjmenované */
  const allowKeys: string[] | null = rawList === undefined || rawList === null ? null : rawList.filter(isValidBaseFundKey);

  const catalogKeys = BASE_FUNDS.filter((f) => f.isActive).map((f) => f.baseFundKey);
  const effectiveAllowedKeys =
    allowKeys === null ? catalogKeys : catalogKeys.filter((k) => allowKeys.includes(k));

  const advisorPrefs = mergeAdvisorPrefs(rawFundLibrary ?? undefined, effectiveAllowedKeys);

  const catalog = BASE_FUNDS.filter((f) => f.isActive)
    .slice()
    .sort((a, b) => {
      const ia = CATALOG_ORDER.indexOf(a.baseFundKey);
      const ib = CATALOG_ORDER.indexOf(b.baseFundKey);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map((f) => ({
      baseFundKey: f.baseFundKey,
      displayName: f.displayName,
      provider: f.provider,
      category: f.category,
      subcategory: f.subcategory,
      logoPath: f.assets.logoPath,
    })) satisfies FundCatalogListItemDTO[];

  let fundAddRequestQueue: FundAddRequestQueueRow[] | undefined;
  if (canEditTenantAllowlist) {
    const rows = await withTenantContext({ tenantId, userId }, (tx) =>
      tx
        .select({
          id: fundAddRequests.id,
          userId: fundAddRequests.userId,
          fundName: fundAddRequests.fundName,
          provider: fundAddRequests.provider,
          isinOrTicker: fundAddRequests.isinOrTicker,
          factsheetUrl: fundAddRequests.factsheetUrl,
          category: fundAddRequests.category,
          note: fundAddRequests.note,
          status: fundAddRequests.status,
          createdAt: fundAddRequests.createdAt,
          updatedAt: fundAddRequests.updatedAt,
        })
        .from(fundAddRequests)
        .where(eq(fundAddRequests.tenantId, tenantId))
        .orderBy(desc(fundAddRequests.createdAt))
        .limit(200),
    );

    fundAddRequestQueue = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      fundName: r.fundName,
      provider: r.provider,
      isinOrTicker: r.isinOrTicker,
      factsheetUrl: r.factsheetUrl,
      category: r.category,
      note: r.note,
      status: normalizeQueueStatus(r.status),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  return {
    canEditTenantAllowlist,
    tenantAllowlist: {
      allowedBaseFundKeys: allowKeys === null ? null : [...allowKeys],
    },
    advisorPrefs,
    effectiveAllowedKeys,
    catalog,
    fundAddRequestQueue,
  };
}
