/**
 * AI Photo / Image Intake — intent-assist result cache v1 (Phase 8).
 *
 * In-process LRU-style cache for `runIntentChangeAssist` results.
 * Prevents repeated expensive model calls for the same ambiguous thread context.
 *
 * Cache key: deterministic hash of the top-N fact values (key + value pairs),
 * normalized and sorted — input-stable across equivalent fact sets.
 *
 * Cache states (returned to caller):
 *   cache_hit       — valid, non-stale entry found; model call skipped
 *   cache_miss      — no entry; caller should run assist + store result
 *   cache_stale     — entry expired (TTL exceeded); treat as miss
 *   cache_bypassed  — caching disabled by config or finding not eligible
 *
 * Safety rules:
 * - Cache is ONLY used when finding.status === "ambiguous"
 * - Stale entries are NEVER used (returned as cache_stale, not cache_hit)
 * - Max entries: 200 (bounded; evicts LRU on overflow)
 * - TTL: 30 minutes (conservative — intent context changes quickly)
 * - On any error, always falls back to cache_bypassed
 * - Does NOT persist across server restarts (in-process only)
 *
 * Cost: zero model calls on cache_hit (main saving goal).
 */

import type { IntentChangeFinding, MergedThreadFact, IntentAssistCacheResult } from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const MAX_CACHE_ENTRIES = 200;
const MAX_FACTS_FOR_KEY = 8;             // Top-N facts used for hashing

// ---------------------------------------------------------------------------
// In-process store (LRU eviction via insertion-order Map)
// ---------------------------------------------------------------------------

type CacheEntry = {
  finding: IntentChangeFinding;
  cachedAt: number;
};

const store = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Deterministic cache key from merged facts.
 * Uses top-N fact key:value pairs, sorted by factKey for stability.
 * Returns null if facts are too sparse to produce a meaningful key.
 */
export function buildIntentAssistCacheKey(
  mergedFacts: MergedThreadFact[],
): string | null {
  if (mergedFacts.length === 0) return null;

  const relevant = mergedFacts
    .filter((f) => f.factKey && String(f.value).trim().length > 0)
    .sort((a, b) => a.factKey.localeCompare(b.factKey))
    .slice(0, MAX_FACTS_FOR_KEY)
    .map((f) => `${f.factKey}:${String(f.value).slice(0, 80).trim()}`);

  if (relevant.length < 2) return null;

  const raw = relevant.join("|");

  // Simple djb2 hash — fast, no crypto dep
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
    hash = hash >>> 0;
  }

  return `iac_v1_${hash.toString(16)}`;
}

// ---------------------------------------------------------------------------
// LRU eviction
// ---------------------------------------------------------------------------

function evictIfNeeded(): void {
  if (store.size < MAX_CACHE_ENTRIES) return;
  const oldestKey = store.keys().next().value;
  if (oldestKey) store.delete(oldestKey);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Looks up a cached intent-assist result for the given facts.
 *
 * Returns IntentAssistCacheResult with the cache status and optional finding.
 * Never throws — returns cache_bypassed on any error.
 */
export function lookupIntentAssistCache(
  finding: IntentChangeFinding,
  mergedFacts: MergedThreadFact[],
): IntentAssistCacheResult {
  try {
    if (finding.status !== "ambiguous") {
      return { cacheStatus: "cache_bypassed", finding: null, cachedAt: null, cacheKey: null };
    }

    const key = buildIntentAssistCacheKey(mergedFacts);
    if (!key) {
      return { cacheStatus: "cache_bypassed", finding: null, cachedAt: null, cacheKey: null };
    }

    const entry = store.get(key);
    if (!entry) {
      return { cacheStatus: "cache_miss", finding: null, cachedAt: null, cacheKey: key };
    }

    const age = Date.now() - entry.cachedAt;
    if (age > CACHE_TTL_MS) {
      store.delete(key);
      return {
        cacheStatus: "cache_stale",
        finding: null,
        cachedAt: new Date(entry.cachedAt).toISOString(),
        cacheKey: key,
      };
    }

    return {
      cacheStatus: "cache_hit",
      finding: entry.finding,
      cachedAt: new Date(entry.cachedAt).toISOString(),
      cacheKey: key,
    };
  } catch {
    return { cacheStatus: "cache_bypassed", finding: null, cachedAt: null, cacheKey: null };
  }
}

/**
 * Stores a result in the cache for the given facts.
 * Only caches when finding.status !== "ambiguous" (resolved result worth caching).
 * Does not cache null results (model errors / skipped).
 * Non-throwing.
 */
export function storeIntentAssistCache(
  mergedFacts: MergedThreadFact[],
  finding: IntentChangeFinding | null,
): void {
  try {
    if (!finding) return;
    // Only cache if the model produced a non-ambiguous result (worth caching)
    if (finding.status === "ambiguous" && finding.confidence < 0.4) return;

    const key = buildIntentAssistCacheKey(mergedFacts);
    if (!key) return;

    evictIfNeeded();
    store.set(key, { finding, cachedAt: Date.now() });
  } catch {
    // Non-throwing
  }
}

/**
 * Clears the entire cache (for testing or forced invalidation).
 */
export function clearIntentAssistCache(): void {
  store.clear();
}

/**
 * Returns current cache stats (for admin/debug visibility).
 */
export function getIntentAssistCacheStats(): {
  size: number;
  maxSize: number;
  ttlMs: number;
} {
  return { size: store.size, maxSize: MAX_CACHE_ENTRIES, ttlMs: CACHE_TTL_MS };
}
