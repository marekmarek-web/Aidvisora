/**
 * AI Photo / Image Intake — intent-assist cache persistence v2 (Phase 9).
 *
 * Adds lightweight DB backing to the in-process intent-assist cache,
 * so results survive request boundaries and process restarts.
 *
 * Storage pattern: reuses `ai_generations` table (same as cross-session persistence):
 *   entityType = "image_intake_intent_assist_cache"
 *   entityId   = "<cacheKey>"
 *   outputText = JSON.stringify(CacheEntry)
 *   contextHash = "v1:<timestamp>"
 *
 * Design:
 * - DB write is fire-and-forget (non-blocking, never breaks lane)
 * - DB read is attempted before returning cache_miss (fallback to in-process)
 * - TTL enforced on read (same 30 min TTL as in-process cache)
 * - Max entries per tenant-scoped cleanup: none (small volume expected)
 * - cache_write_failed is a new status for observable write failures
 *
 * States returned:
 *   cache_hit           — valid result (from in-process or DB)
 *   cache_miss          — no valid entry anywhere
 *   cache_stale         — entry found but expired
 *   cache_bypassed      — caching not applicable (non-ambiguous / empty facts)
 *   cache_write_failed  — DB persist failed (in-process write succeeded or was skipped)
 *
 * Cost: max 1 DB read + 1 DB write per assist call boundary.
 * Model call savings: same as in-process cache — zero calls on cache_hit.
 */

import "server-only";
import { aiGenerations, eq, and, desc } from "db";
import type { IntentChangeFinding, MergedThreadFact, IntentAssistCacheResult } from "./types";
import { buildIntentAssistCacheKey, lookupIntentAssistCache, storeIntentAssistCache } from "./intent-assist-cache";
import { withServiceTenantContext } from "@/lib/db/service-db";

const ENTITY_TYPE = "image_intake_intent_assist_cache";
const CACHE_TTL_MS = 30 * 60 * 1000; // Must match in-process cache TTL

type PersistedEntry = {
  finding: IntentChangeFinding;
  cachedAt: number;
};

// ---------------------------------------------------------------------------
// DB read
// ---------------------------------------------------------------------------

async function loadFromDb(cacheKey: string, tenantId: string): Promise<IntentChangeFinding | null> {
  try {
    const rows = await withServiceTenantContext({ tenantId }, async (tx) =>
      tx
        .select({ outputText: aiGenerations.outputText, createdAt: aiGenerations.createdAt })
        .from(aiGenerations)
        .where(
          and(
            eq(aiGenerations.tenantId, tenantId),
            eq(aiGenerations.entityType, ENTITY_TYPE),
            eq(aiGenerations.entityId, cacheKey),
          ),
        )
        .orderBy(desc(aiGenerations.createdAt))
        .limit(1),
    );

    if (rows.length === 0 || !rows[0]?.outputText) return null;

    const entry = JSON.parse(rows[0].outputText) as PersistedEntry;
    if (typeof entry?.cachedAt !== "number") return null;

    const age = Date.now() - entry.cachedAt;
    if (age > CACHE_TTL_MS) return null; // stale in DB

    return entry.finding ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB write (fire-and-forget)
// ---------------------------------------------------------------------------

async function persistToDb(
  cacheKey: string,
  tenantId: string,
  userId: string,
  finding: IntentChangeFinding,
): Promise<boolean> {
  try {
    const entry: PersistedEntry = { finding, cachedAt: Date.now() };
    const serialized = JSON.stringify(entry);

    await withServiceTenantContext({ tenantId, userId }, async (tx) => {
      await tx
        .delete(aiGenerations)
        .where(
          and(
            eq(aiGenerations.tenantId, tenantId),
            eq(aiGenerations.entityType, ENTITY_TYPE),
            eq(aiGenerations.entityId, cacheKey),
          ),
        );

      await tx.insert(aiGenerations).values({
        tenantId,
        entityType: ENTITY_TYPE,
        entityId: cacheKey,
        promptType: "intent_assist_cache",
        promptId: "intent_assist_v2",
        promptVersion: "2",
        generatedByUserId: userId,
        outputText: serialized,
        status: "success",
        contextHash: `v2:${Date.now()}`,
      });
    });

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API — persistent cache lookup + store
// ---------------------------------------------------------------------------

/**
 * Looks up intent-assist result from in-process cache first, then DB.
 *
 * Falls back to in-process cache hit → DB read → miss/bypassed.
 * Never throws.
 */
export async function lookupIntentAssistCachePersistent(
  finding: IntentChangeFinding,
  mergedFacts: MergedThreadFact[],
  tenantId: string,
): Promise<IntentAssistCacheResult> {
  // Fast path: in-process hit
  const inProcess = lookupIntentAssistCache(finding, mergedFacts);
  if (inProcess.cacheStatus === "cache_hit" || inProcess.cacheStatus === "cache_bypassed") {
    return inProcess;
  }

  const key = inProcess.cacheKey ?? buildIntentAssistCacheKey(mergedFacts);
  if (!key) {
    return { cacheStatus: "cache_bypassed", finding: null, cachedAt: null, cacheKey: null };
  }

  // DB fallback
  const dbFinding = await loadFromDb(key, tenantId);
  if (dbFinding) {
    // Warm in-process cache too
    storeIntentAssistCache(mergedFacts, dbFinding);
    return {
      cacheStatus: "cache_hit",
      finding: dbFinding,
      cachedAt: new Date().toISOString(),
      cacheKey: key,
    };
  }

  return {
    cacheStatus: "cache_miss",
    finding: null,
    cachedAt: null,
    cacheKey: key,
  };
}

/**
 * Stores intent-assist result in both in-process cache and DB.
 *
 * Returns updated cache status — `cache_write_failed` if DB write failed
 * but in-process store succeeded.
 * Never throws.
 */
export async function storeIntentAssistCachePersistent(
  mergedFacts: MergedThreadFact[],
  finding: IntentChangeFinding | null,
  tenantId: string,
  userId: string,
): Promise<"stored" | "cache_write_failed" | "cache_bypassed"> {
  if (!finding) return "cache_bypassed";
  if (finding.status === "ambiguous" && finding.confidence < 0.4) return "cache_bypassed";

  const key = buildIntentAssistCacheKey(mergedFacts);
  if (!key) return "cache_bypassed";

  // Store in-process (synchronous, always)
  storeIntentAssistCache(mergedFacts, finding);

  // Store in DB (async, non-blocking)
  const dbOk = await persistToDb(key, tenantId, userId, finding);
  return dbOk ? "stored" : "cache_write_failed";
}
