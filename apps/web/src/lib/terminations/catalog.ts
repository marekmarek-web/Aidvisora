import "server-only";
import { eq, isNull, or } from "drizzle-orm";
import { insurerTerminationRegistry, terminationReasonCatalog } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import type { InsurerRegistryRow, ReasonCatalogRow } from "./types";
import type { TerminationDefaultDateComputation } from "db";

/** Normalizuje alias/název pojišťovny na lowercase bez diakritiky pro fuzzy matching. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
}

function toInsurerRow(r: typeof insurerTerminationRegistry.$inferSelect): InsurerRegistryRow {
  return {
    id: r.id,
    catalogKey: r.catalogKey,
    insurerName: r.insurerName,
    aliases: (r.aliases as string[] | null) ?? [],
    supportedSegments: (r.supportedSegments as string[] | null) ?? [],
    mailingAddress: (r.mailingAddress as Record<string, unknown> | null) ?? null,
    email: r.email,
    dataBox: r.dataBox,
    webFormUrl: r.webFormUrl,
    clientPortalUrl: r.clientPortalUrl,
    freeformLetterAllowed: r.freeformLetterAllowed,
    requiresOfficialForm: r.requiresOfficialForm,
    officialFormName: r.officialFormName,
    officialFormStoragePath: r.officialFormStoragePath,
    officialFormNotes: r.officialFormNotes,
    allowedChannels: (r.allowedChannels as string[] | null) ?? [],
    ruleOverrides: (r.ruleOverrides as Record<string, unknown> | null) ?? {},
    attachmentRules: (r.attachmentRules as Record<string, unknown> | null) ?? {},
    registryNeedsVerification: r.registryNeedsVerification,
  };
}

function toReasonRow(r: typeof terminationReasonCatalog.$inferSelect): ReasonCatalogRow {
  return {
    id: r.id,
    reasonCode: r.reasonCode,
    labelCs: r.labelCs,
    supportedSegments: (r.supportedSegments as string[] | null) ?? [],
    defaultDateComputation: r.defaultDateComputation as TerminationDefaultDateComputation,
    requiredFields: (r.requiredFields as string[] | null) ?? [],
    attachmentRequired: r.attachmentRequired,
    alwaysReview: r.alwaysReview,
    instructions: r.instructions,
    sortOrder: r.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Insurer registry
// ---------------------------------------------------------------------------

/**
 * Vrátí všechny aktivní záznamy pro daného tenanta + globální katalog (tenant_id NULL).
 * Výsledky jsou řazeny: tenant-specific první, pak globální.
 */
export async function getAllInsurers(tenantId: string): Promise<InsurerRegistryRow[]> {
  const rows = await withTenantContext({ tenantId }, async (tx) =>
    tx
      .select()
      .from(insurerTerminationRegistry)
      .where(
        or(eq(insurerTerminationRegistry.tenantId, tenantId), isNull(insurerTerminationRegistry.tenantId))
      )
  );

  const active = rows.filter((r) => r.active);
  active.sort((a, b) => {
    const aIsGlobal = a.tenantId === null ? 1 : 0;
    const bIsGlobal = b.tenantId === null ? 1 : 0;
    return aIsGlobal - bIsGlobal;
  });

  return active.map(toInsurerRow);
}

/**
 * Přesné vyhledání dle `catalog_key` (prioritizuje tenant-specific před globálním).
 */
export async function findInsurerByCatalogKey(
  tenantId: string,
  catalogKey: string
): Promise<InsurerRegistryRow | null> {
  const rows = await withTenantContext({ tenantId }, async (tx) =>
    tx
      .select()
      .from(insurerTerminationRegistry)
      .where(eq(insurerTerminationRegistry.catalogKey, catalogKey))
  );

  const tenant = rows.find((r) => r.tenantId === tenantId && r.active);
  if (tenant) return toInsurerRow(tenant);
  const global = rows.find((r) => r.tenantId === null && r.active);
  return global ? toInsurerRow(global) : null;
}

/**
 * Fuzzy vyhledání pojišťovny podle volného textu (název nebo alias).
 * Vrátí první nejlepší shodu nebo null.
 * Priorita: tenant-specific > globální; přesná shoda > partial.
 */
export async function findInsurerByName(
  tenantId: string,
  name: string
): Promise<InsurerRegistryRow | null> {
  const all = await getAllInsurers(tenantId);
  const needle = normalize(name);

  // Priorita 1: přesná shoda na název
  const exactName = all.find((r) => normalize(r.insurerName) === needle);
  if (exactName) return exactName;

  // Priorita 2: přesná shoda na alias
  const exactAlias = all.find((r) => r.aliases.some((a) => normalize(a) === needle));
  if (exactAlias) return exactAlias;

  // Priorita 3: obsahuje needle
  const partial = all.find(
    (r) =>
      normalize(r.insurerName).includes(needle) ||
      r.aliases.some((a) => normalize(a).includes(needle)) ||
      needle.includes(normalize(r.insurerName))
  );
  return partial ?? null;
}

// ---------------------------------------------------------------------------
// Reason catalog
// ---------------------------------------------------------------------------

/**
 * Vrátí aktivní důvody pro daný segment (nebo všechny, pokud segment null).
 * Řazení dle sort_order.
 */
export async function getReasonsForSegment(
  tenantId: string,
  segment: string | null
): Promise<ReasonCatalogRow[]> {
  const rows = await withTenantContext({ tenantId }, async (tx) =>
    tx
      .select()
      .from(terminationReasonCatalog)
      .where(
        or(eq(terminationReasonCatalog.tenantId, tenantId), isNull(terminationReasonCatalog.tenantId))
      )
  );

  return rows
    .filter((r) => {
      if (!r.active) return false;
      if (!segment) return true;
      const segs = (r.supportedSegments as string[] | null) ?? [];
      return segs.length === 0 || segs.includes(segment);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toReasonRow);
}

/**
 * Najde konkrétní důvod dle kódu pro tenanta (s fallback na globální).
 */
export async function findReasonByCode(
  tenantId: string,
  reasonCode: string
): Promise<ReasonCatalogRow | null> {
  const rows = await withTenantContext({ tenantId }, async (tx) =>
    tx
      .select()
      .from(terminationReasonCatalog)
      .where(eq(terminationReasonCatalog.reasonCode, reasonCode))
  );

  const tenant = rows.find((r) => r.tenantId === tenantId && r.active);
  if (tenant) return toReasonRow(tenant);
  const global = rows.find((r) => r.tenantId === null && r.active);
  return global ? toReasonRow(global) : null;
}
