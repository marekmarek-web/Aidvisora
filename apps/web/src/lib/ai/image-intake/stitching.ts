/**
 * AI Photo / Image Intake — multi-image session stitching v1 (Phase 4).
 *
 * Cheap-first grouping of multiple image assets in a single intake request.
 * Strategy:
 *   1. Exact duplicate detection (content hash — free, already in preflight)
 *   2. Near-duplicate heuristics (size ± 5%, same MIME, same resolution)
 *   3. Same-type grouping (same inputType from classifier, ordered batch)
 *   4. Mixed/unrelated → standalone (no forced grouping)
 *
 * Cost rules:
 * - NO additional model calls for stitching
 * - Reuses existing classification results and asset metadata
 * - Only groups when there is positive evidence; conservative by default
 * - Supporting/reference assets never merged with communication assets
 * - If stitching flag is off, returns each asset as standalone
 */

import { randomUUID } from "crypto";
import type {
  NormalizedImageAsset,
  InputClassificationResult,
  MultiImageStitchingResult,
  StitchedAssetGroup,
  StitchingDecision,
} from "./types";

// ---------------------------------------------------------------------------
// Heuristic thresholds
// ---------------------------------------------------------------------------

/** Max size ratio between two assets to consider near-duplicate. */
const NEAR_DUPLICATE_SIZE_RATIO = 0.05; // 5%
/** Max resolution diff (each axis) to consider near-duplicate. */
const NEAR_DUPLICATE_RESOLUTION_DIFF_PX = 30;

// ---------------------------------------------------------------------------
// Duplicate detection (metadata-based, no model call)
// ---------------------------------------------------------------------------

function isExactDuplicate(a: NormalizedImageAsset, b: NormalizedImageAsset): boolean {
  if (a.contentHash && b.contentHash) {
    return a.contentHash === b.contentHash;
  }
  return false;
}

function isNearDuplicate(a: NormalizedImageAsset, b: NormalizedImageAsset): boolean {
  if (a.mimeType !== b.mimeType) return false;

  if (a.sizeBytes && b.sizeBytes) {
    const larger = Math.max(a.sizeBytes, b.sizeBytes);
    const ratio = Math.abs(a.sizeBytes - b.sizeBytes) / larger;
    if (ratio > NEAR_DUPLICATE_SIZE_RATIO) return false;
  }

  if (a.width && b.width && a.height && b.height) {
    if (
      Math.abs(a.width - b.width) > NEAR_DUPLICATE_RESOLUTION_DIFF_PX ||
      Math.abs(a.height - b.height) > NEAR_DUPLICATE_RESOLUTION_DIFF_PX
    ) {
      return false;
    }
  }

  // If metadata is consistent and there's no hash, treat as near-duplicate
  return true;
}

// ---------------------------------------------------------------------------
// Type grouping (reuses classification results — no extra model call)
// ---------------------------------------------------------------------------

/** Input types that can be grouped together as a thread. */
const THREAD_GROUPABLE_TYPES = new Set([
  "screenshot_client_communication",
]);

/** Input types that can be grouped as related (same category, different content). */
const RELATED_GROUPABLE_TYPES = new Set([
  "screenshot_payment_details",
  "screenshot_bank_or_finance_info",
  "photo_or_scan_document",
]);

/** Input types that must always be standalone. */
const ALWAYS_STANDALONE_TYPES = new Set([
  "supporting_reference_image",
  "general_unusable_image",
  "mixed_or_uncertain_image",
]);

type AssetWithClassification = {
  asset: NormalizedImageAsset;
  classification: InputClassificationResult | null;
};

function decideGroupType(
  a: InputClassificationResult | null,
  b: InputClassificationResult | null,
): StitchingDecision | null {
  if (!a || !b) return null;
  if (ALWAYS_STANDALONE_TYPES.has(a.inputType) || ALWAYS_STANDALONE_TYPES.has(b.inputType)) return null;

  if (a.inputType === b.inputType && THREAD_GROUPABLE_TYPES.has(a.inputType)) {
    return "grouped_thread";
  }

  if (a.inputType === b.inputType && RELATED_GROUPABLE_TYPES.has(a.inputType)) {
    return "grouped_related";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main stitching algorithm
// ---------------------------------------------------------------------------

/**
 * Groups multiple image assets from a single intake request.
 * Pure metadata + classification reasoning — no model calls.
 *
 * Algorithm:
 * 1. Mark exact duplicates
 * 2. Mark near-duplicates (of non-exact matches)
 * 3. Group remaining assets by inputType if threadable/related
 * 4. Remaining assets are standalone
 */
export function computeStitchingGroups(
  assets: NormalizedImageAsset[],
  classifications: Map<string, InputClassificationResult | null>,
): MultiImageStitchingResult {
  if (assets.length <= 1) {
    const solo = assets[0];
    if (!solo) return emptyStitchingResult();
    return {
      groups: [{
        groupId: randomUUID().slice(0, 8),
        decision: "standalone",
        assetIds: [solo.assetId],
        primaryAssetId: solo.assetId,
        duplicateAssetIds: [],
        confidence: 1.0,
        rationale: "Single asset — no grouping needed.",
      }],
      standaloneAssetIds: [solo.assetId],
      duplicateAssetIds: [],
      hasGroupedAssets: false,
      stitchingConfidence: 1.0,
    };
  }

  const processed = new Set<string>();
  const duplicateIds = new Set<string>();
  const groups: StitchedAssetGroup[] = [];

  // Pass 1: duplicate detection
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i]!;
    if (processed.has(a.assetId)) continue;

    const dups: string[] = [];
    for (let j = i + 1; j < assets.length; j++) {
      const b = assets[j]!;
      if (processed.has(b.assetId)) continue;

      if (isExactDuplicate(a, b)) {
        dups.push(b.assetId);
        processed.add(b.assetId);
        duplicateIds.add(b.assetId);
      } else if (isNearDuplicate(a, b)) {
        dups.push(b.assetId);
        processed.add(b.assetId);
        duplicateIds.add(b.assetId);
      }
    }

    if (dups.length > 0) {
      processed.add(a.assetId);
      groups.push({
        groupId: randomUUID().slice(0, 8),
        decision: "duplicate",
        assetIds: [a.assetId, ...dups],
        primaryAssetId: a.assetId,
        duplicateAssetIds: dups,
        confidence: 0.9,
        rationale: `${dups.length} duplikát${dups.length > 1 ? "ů" : ""} potlačen.`,
      });
    }
  }

  // Pass 2: type grouping (only non-duplicated assets)
  const remaining = assets.filter((a) => !processed.has(a.assetId));
  const alreadyGrouped = new Set<string>();

  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]!;
    if (alreadyGrouped.has(a.assetId)) continue;

    const classA = classifications.get(a.assetId) ?? null;
    const classType = classA?.inputType;

    if (!classType || ALWAYS_STANDALONE_TYPES.has(classType)) continue;

    const relatedIds: string[] = [];
    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j]!;
      if (alreadyGrouped.has(b.assetId)) continue;
      const classB = classifications.get(b.assetId) ?? null;
      const groupType = decideGroupType(classA, classB);
      if (groupType) {
        relatedIds.push(b.assetId);
      }
    }

    if (relatedIds.length > 0) {
      const allIds = [a.assetId, ...relatedIds];
      allIds.forEach((id) => alreadyGrouped.add(id));
      const groupType = decideGroupType(classA, classifications.get(relatedIds[0]!) ?? null) ?? "grouped_related";
      groups.push({
        groupId: randomUUID().slice(0, 8),
        decision: groupType,
        assetIds: allIds,
        primaryAssetId: a.assetId,
        duplicateAssetIds: [],
        confidence: 0.75,
        rationale:
          groupType === "grouped_thread"
            ? `${allIds.length} screenshotů pravděpodobně ze stejné komunikace.`
            : `${allIds.length} obrázků stejného typu — navazující vstup.`,
      });
    }
  }

  // Pass 3: standalones
  const standaloneIds: string[] = [];
  for (const asset of remaining) {
    if (!alreadyGrouped.has(asset.assetId)) {
      standaloneIds.push(asset.assetId);
      groups.push({
        groupId: randomUUID().slice(0, 8),
        decision: "standalone",
        assetIds: [asset.assetId],
        primaryAssetId: asset.assetId,
        duplicateAssetIds: [],
        confidence: 1.0,
        rationale: "Samostatný asset — nesouvisí s ostatními.",
      });
    }
  }

  const hasGrouped = groups.some((g) => g.decision === "grouped_thread" || g.decision === "grouped_related");
  const overallConf = hasGrouped ? 0.75 : 1.0;

  return {
    groups,
    standaloneAssetIds: standaloneIds,
    duplicateAssetIds: Array.from(duplicateIds),
    hasGroupedAssets: hasGrouped,
    stitchingConfidence: overallConf,
  };
}

function emptyStitchingResult(): MultiImageStitchingResult {
  return {
    groups: [],
    standaloneAssetIds: [],
    duplicateAssetIds: [],
    hasGroupedAssets: false,
    stitchingConfidence: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Dedup: prevent duplicate action proposals from overlapping assets
// ---------------------------------------------------------------------------

/**
 * Given a stitching result, returns the set of asset IDs that should be
 * used as primary representatives for processing. Duplicate assets are
 * excluded to prevent duplicate action proposals.
 */
export function getPrimaryAssetIds(stitching: MultiImageStitchingResult): string[] {
  const seen = new Set<string>();
  const primaryIds: string[] = [];

  for (const group of stitching.groups) {
    if (!seen.has(group.primaryAssetId)) {
      primaryIds.push(group.primaryAssetId);
      seen.add(group.primaryAssetId);
    }
  }

  return primaryIds;
}

/**
 * Returns a human-readable stitching summary for preview.
 */
export function buildStitchingSummary(stitching: MultiImageStitchingResult): string | null {
  if (!stitching.hasGroupedAssets && stitching.duplicateAssetIds.length === 0) return null;

  const parts: string[] = [];

  if (stitching.duplicateAssetIds.length > 0) {
    parts.push(`${stitching.duplicateAssetIds.length} duplicitní obrázek${stitching.duplicateAssetIds.length > 1 ? "y" : ""} byl potlačen${stitching.duplicateAssetIds.length > 1 ? "y" : ""}.`);
  }

  const threadGroups = stitching.groups.filter((g) => g.decision === "grouped_thread");
  const relatedGroups = stitching.groups.filter((g) => g.decision === "grouped_related");

  if (threadGroups.length > 0) {
    const totalAssets = threadGroups.reduce((sum, g) => sum + g.assetIds.length, 0);
    parts.push(`${totalAssets} screenshotů bylo sloučeno jako pravděpodobná komunikační vlákna.`);
  }

  if (relatedGroups.length > 0) {
    const totalAssets = relatedGroups.reduce((sum, g) => sum + g.assetIds.length, 0);
    parts.push(`${totalAssets} navazujících obrázků bylo zpracováno jako jeden balíček.`);
  }

  return parts.join(" ");
}
