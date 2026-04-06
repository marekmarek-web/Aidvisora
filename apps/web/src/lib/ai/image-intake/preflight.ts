/**
 * AI Photo / Image Intake — preflight validation and deterministic gating.
 *
 * Cheap, synchronous checks run before any model call.
 * Decides eligibility, flags quality issues and catches duplicates.
 */

import type { NormalizedImageAsset, ImagePreflightResult, ImageQualityLevel } from "./types";
import {
  SUPPORTED_IMAGE_MIMES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_INTAKE,
} from "./types";

// ---------------------------------------------------------------------------
// Quality heuristic (deterministic placeholder — Phase 2 adds model-based)
// ---------------------------------------------------------------------------

function assessQuality(asset: NormalizedImageAsset): ImageQualityLevel {
  if (!asset.width || !asset.height) return "acceptable";

  const pixels = asset.width * asset.height;
  if (pixels < 100 * 100) return "unusable";
  if (pixels < 300 * 300) return "poor";
  if (pixels < 640 * 480) return "acceptable";
  return "good";
}

// ---------------------------------------------------------------------------
// Duplicate check (hash-based placeholder)
// ---------------------------------------------------------------------------

const sessionHashCache = new Map<string, Set<string>>();

function isDuplicateInSession(sessionId: string, contentHash: string | null): boolean {
  if (!contentHash) return false;
  const seen = sessionHashCache.get(sessionId);
  if (!seen) return false;
  return seen.has(contentHash);
}

function recordHashInSession(sessionId: string, contentHash: string | null): void {
  if (!contentHash) return;
  let seen = sessionHashCache.get(sessionId);
  if (!seen) {
    seen = new Set();
    sessionHashCache.set(sessionId, seen);
  }
  seen.add(contentHash);
}

/** Purge session caches older than 30 min (aligned with assistant session TTL). */
export function purgePreflightCache(sessionId: string): void {
  sessionHashCache.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Preflight runner
// ---------------------------------------------------------------------------

export function runImagePreflight(
  asset: NormalizedImageAsset,
  sessionId: string,
): ImagePreflightResult {
  const warnings: string[] = [];
  let rejectReason: string | null = null;

  const mimeSupported = SUPPORTED_IMAGE_MIMES.has(asset.mimeType);
  if (!mimeSupported) {
    rejectReason = "unsupported_mime";
    warnings.push(`MIME typ ${asset.mimeType} není podporovaný pro image intake.`);
  }

  const sizeWithinLimits = asset.sizeBytes <= MAX_IMAGE_SIZE_BYTES;
  if (!sizeWithinLimits) {
    rejectReason = rejectReason ?? "file_too_large";
    warnings.push(`Soubor je příliš velký (${(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB, limit ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB).`);
  }

  const qualityLevel = assessQuality(asset);
  if (qualityLevel === "unusable") {
    rejectReason = rejectReason ?? "unusable_quality";
    warnings.push("Obrázek je příliš malý nebo nekvalitní pro zpracování.");
  }

  const isDuplicate = isDuplicateInSession(sessionId, asset.contentHash);
  if (isDuplicate) {
    warnings.push("Tento obrázek byl v aktuální session již zpracován.");
  }

  if (!isDuplicate) {
    recordHashInSession(sessionId, asset.contentHash);
  }

  const eligible = !rejectReason;

  return {
    eligible,
    qualityLevel,
    isDuplicate,
    mimeSupported,
    sizeWithinLimits,
    rejectReason,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Batch validation
// ---------------------------------------------------------------------------

export type BatchPreflightResult = {
  eligible: boolean;
  assetResults: Array<{ assetId: string; result: ImagePreflightResult }>;
  batchWarnings: string[];
};

export function runBatchPreflight(
  assets: NormalizedImageAsset[],
  sessionId: string,
): BatchPreflightResult {
  const batchWarnings: string[] = [];

  if (assets.length === 0) {
    return {
      eligible: false,
      assetResults: [],
      batchWarnings: ["Žádné obrázky k zpracování."],
    };
  }

  if (assets.length > MAX_IMAGES_PER_INTAKE) {
    batchWarnings.push(
      `Maximální počet obrázků na intake je ${MAX_IMAGES_PER_INTAKE}, nahráno ${assets.length}.`,
    );
  }

  const capped = assets.slice(0, MAX_IMAGES_PER_INTAKE);
  const assetResults = capped.map((asset) => ({
    assetId: asset.assetId,
    result: runImagePreflight(asset, sessionId),
  }));

  const hasAnyEligible = assetResults.some((r) => r.result.eligible);

  return {
    eligible: hasAnyEligible,
    assetResults,
    batchWarnings,
  };
}
