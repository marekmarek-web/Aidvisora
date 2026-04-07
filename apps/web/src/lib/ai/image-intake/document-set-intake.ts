/**
 * AI Photo / Image Intake — multi-image document set intake expansion v1 (Phase 8).
 *
 * Extends stitching coverage for document-like multi-image intake scenarios.
 * E.g.: advisor uploads 3 photos of the same multi-page contract or policy document.
 *
 * Design:
 * - Conservative by default — only merges when there is strong positive evidence
 * - Does NOT trigger AI Review processing — handoff recommendation only
 * - Reuses existing StitchedAssetGroup, ExtractedFactBundle and ReviewHandoffRecommendation types
 * - No additional model calls beyond the existing multimodal pass results
 *
 * Output decisions:
 *   consolidated_document_facts  — related pages, high confidence → merge fact bundles
 *   review_handoff_candidate     — review-like document set → recommend AI Review handoff
 *   supporting_reference_set     — reference images → archive only
 *   mixed_document_set           — mixed types → process independently (no merge)
 *   insufficient_for_merge       — low confidence → standalone processing
 *
 * Safety rules:
 * - Communication screenshots MUST NOT be merged with document images
 * - Review-like documents STAY as handoff candidates; never silently structured
 * - Supporting/reference images never merged into document sets
 * - Mixed sets (communication + document) always return mixed_document_set
 *
 * Cost: Zero additional model calls.
 */

import type {
  ExtractedFactBundle,
  ExtractedImageFact,
  StitchedAssetGroup,
  InputClassificationResult,
  DocumentMultiImageResult,
} from "./types";

// ---------------------------------------------------------------------------
// Review-like document detection
// ---------------------------------------------------------------------------

/** Fact keys that suggest the document is a review/contract candidate. */
const REVIEW_SIGNAL_KEYS = new Set([
  "looks_like_contract",
]);

function hasReviewSignal(bundle: ExtractedFactBundle): boolean {
  return bundle.facts.some(
    (f) =>
      REVIEW_SIGNAL_KEYS.has(f.factKey) &&
      f.value != null &&
      String(f.value).length > 0 &&
      f.confidence > 0.5,
  );
}

function isContractLike(bundle: ExtractedFactBundle): boolean {
  return bundle.facts.some(
    (f) =>
      f.factKey === "looks_like_contract" &&
      String(f.value).toLowerCase().includes("true"),
  );
}

// ---------------------------------------------------------------------------
// Communication contamination check
// ---------------------------------------------------------------------------

function hasCommunicationAsset(
  classifications: Map<string, InputClassificationResult | null>,
  assetIds: string[],
): boolean {
  return assetIds.some(
    (id) => classifications.get(id)?.inputType === "screenshot_client_communication",
  );
}

function allDocumentType(
  classifications: Map<string, InputClassificationResult | null>,
  assetIds: string[],
): boolean {
  return assetIds.every(
    (id) => classifications.get(id)?.inputType === "photo_or_scan_document",
  );
}

function allSupportingReference(
  classifications: Map<string, InputClassificationResult | null>,
  assetIds: string[],
): boolean {
  return assetIds.every(
    (id) => classifications.get(id)?.inputType === "supporting_reference_image",
  );
}

// ---------------------------------------------------------------------------
// Fact merging (dedup by factKey — prefer higher confidence)
// ---------------------------------------------------------------------------

function mergeFacts(bundles: ExtractedFactBundle[]): ExtractedImageFact[] {
  const byKey = new Map<string, ExtractedImageFact>();

  for (const bundle of bundles) {
    for (const fact of bundle.facts) {
      const existing = byKey.get(fact.factKey);
      if (!existing || fact.confidence > existing.confidence) {
        byKey.set(fact.factKey, fact);
      }
    }
  }

  return Array.from(byKey.values());
}

function mergeFactBundles(
  bundles: ExtractedFactBundle[],
  groupAssetIds: string[],
): ExtractedFactBundle {
  const mergedFacts = mergeFacts(bundles);
  const missingFields = [...new Set(bundles.flatMap((b) => b.missingFields))];
  const ambiguityReasons = [...new Set(bundles.flatMap((b) => b.ambiguityReasons))];

  const facts: ExtractedImageFact[] =
    mergedFacts.length === 0
      ? mergedFacts
      : mergedFacts.map((f) => ({
          ...f,
          evidence: f.evidence
            ? {
                ...f.evidence,
                evidenceText:
                  `${f.evidence.evidenceText ?? ""} [merged from ${groupAssetIds.length} pages]`.trim(),
              }
            : null,
        }));

  return {
    facts,
    missingFields,
    ambiguityReasons,
    extractionSource: "multimodal_pass",
  };
}

// ---------------------------------------------------------------------------
// Min confidence for merging document pages
// ---------------------------------------------------------------------------

const MIN_MERGE_CONFIDENCE = 0.6;

function groupConfidence(
  classifications: Map<string, InputClassificationResult | null>,
  assetIds: string[],
): number {
  const confs = assetIds
    .map((id) => classifications.get(id)?.confidence ?? 0)
    .filter((c) => c > 0);
  if (confs.length === 0) return 0;
  return confs.reduce((a, b) => a + b, 0) / confs.length;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Evaluates a stitched document asset group and decides how to process it.
 *
 * Call for groups where `group.decision === "grouped_related"` and the
 * assets appear to be document-like (not communication screenshots).
 *
 * @param group          The stitched asset group (from computeStitchingGroups)
 * @param classifications Classification results per assetId
 * @param factBundles    Extracted fact bundles per assetId (from multimodal pass)
 */
export function evaluateDocumentMultiImageSet(
  group: StitchedAssetGroup,
  classifications: Map<string, InputClassificationResult | null>,
  factBundles: Map<string, ExtractedFactBundle>,
): DocumentMultiImageResult {
  const assetIds = group.assetIds;

  // Safety: communication contamination → never merge
  if (hasCommunicationAsset(classifications, assetIds)) {
    return {
      decision: "mixed_document_set",
      mergedFactBundle: null,
      documentSetSummary: "Skupina obsahuje komunikační screenshot — nelze sloučit s dokumenty.",
      confidence: 0,
      assetIds,
    };
  }

  // All supporting/reference → archive set
  if (allSupportingReference(classifications, assetIds)) {
    return {
      decision: "supporting_reference_set",
      mergedFactBundle: null,
      documentSetSummary: "Skupina obsahuje pouze referenční/doplňkové obrázky.",
      confidence: group.confidence,
      assetIds,
    };
  }

  // Not all document type → mixed set
  if (!allDocumentType(classifications, assetIds)) {
    return {
      decision: "mixed_document_set",
      mergedFactBundle: null,
      documentSetSummary: "Skupina obsahuje obrázky různých typů — zpracovány samostatně.",
      confidence: 0,
      assetIds,
    };
  }

  // Collect fact bundles for the group
  const bundles = assetIds
    .map((id) => factBundles.get(id))
    .filter((b): b is ExtractedFactBundle => b !== undefined);

  // Low confidence or no facts → insufficient
  const conf = groupConfidence(classifications, assetIds);
  if (conf < MIN_MERGE_CONFIDENCE || bundles.length === 0) {
    return {
      decision: "insufficient_for_merge",
      mergedFactBundle: null,
      documentSetSummary: "Příliš nízká jistota pro sloučení dokumentových stránek.",
      confidence: conf,
      assetIds,
    };
  }

  // Detect review/contract-like signals → handoff candidate
  const hasAnyReviewSignal = bundles.some(hasReviewSignal);
  const hasContractLike = bundles.some(isContractLike);

  if (hasAnyReviewSignal || hasContractLike) {
    return {
      decision: "review_handoff_candidate",
      mergedFactBundle: null,
      documentSetSummary:
        `Skupina ${assetIds.length} dokumentových stránek vypadá jako smlouva nebo přehled — doporučen handoff do AI Review.`,
      confidence: conf,
      assetIds,
    };
  }

  // All clear — merge fact bundles
  const mergedBundle = mergeFactBundles(bundles, assetIds);

  return {
    decision: "consolidated_document_facts",
    mergedFactBundle: mergedBundle,
    documentSetSummary: `${assetIds.length} dokumentových stránek bylo sloučeno do jednoho přehledu.`,
    confidence: conf,
    assetIds,
  };
}

/**
 * Returns a human-readable preview note for a DocumentMultiImageResult.
 */
export function buildDocumentSetPreviewNote(result: DocumentMultiImageResult): string {
  const counts = `(${result.assetIds.length} obr.)`;
  switch (result.decision) {
    case "consolidated_document_facts":
      return `📑 Dokumenty sloučeny ${counts}: ${result.documentSetSummary ?? ""}`;
    case "review_handoff_candidate":
      return `📋 Kandidát pro AI Review ${counts}: ${result.documentSetSummary ?? ""}`;
    case "supporting_reference_set":
      return `🗂 Referenční podklady ${counts} — archivováno.`;
    case "mixed_document_set":
      return `⚠ Smíšená skupina ${counts} — zpracovány samostatně.`;
    case "insufficient_for_merge":
      return `❓ Nedostatečná jistota pro sloučení ${counts} — zpracovány samostatně.`;
    default:
      return `Dokumenty ${counts}`;
  }
}
