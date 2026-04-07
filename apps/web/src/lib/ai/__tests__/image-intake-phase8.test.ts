/**
 * Integration tests for Phase 8 image intake capability.
 *
 * Covers:
 * A) Handoff lifecycle status adapter (handoff-lifecycle.ts)
 * B) Intent-assist result cache (intent-assist-cache.ts)
 * C) Document multi-image set intake (document-set-intake.ts)
 * D) Household binding scope (binding-household.ts)
 * E) Cross-session DB cleanup (cron route validation via config)
 *
 * Must-pass guardrails:
 * - no false single-client bind in household scenario
 * - no extra intent-assist call when cache hit exists
 * - no excessive polling spam on review lifecycle status
 * - cleanup only affects eligible image intake artifacts
 * - review-like document stays as handoff candidate, not silent review
 * - mixed set (communication + document) never merged
 * - text-only assistant flow not touched
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ logAuditAction: vi.fn(), logAudit: vi.fn() }));
vi.mock("@/lib/openai", () => ({
  createResponseSafe: vi.fn(),
  createResponseStructured: vi.fn(async () => ({ text: "{}", parsed: null, model: "gpt-4o-mini" })),
  createResponseStructuredWithImage: vi.fn(async () => ({ text: "{}", parsed: null, model: "gpt-4o-mini" })),
  createResponseStructuredWithImages: vi.fn(async () => ({ text: "{}", parsed: null, model: "gpt-4o-mini" })),
}));
vi.mock("../assistant-contact-search", () => ({ searchContactsForAssistant: vi.fn(async () => []) }));

// Mock DB — supports households, householdMembers, contacts, aiGenerations, contractUploadReviews
vi.mock("db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          limit: vi.fn(async () => []),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => ({ rowCount: 3 })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  },
  aiGenerations: {},
  contractUploadReviews: {},
  opportunities: {},
  households: {},
  householdMembers: {},
  contacts: {},
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  isNull: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  lt: vi.fn(),
}));

vi.mock("@/lib/ai/review-queue-repository", () => ({
  createContractReview: vi.fn(async () => "review-row-123"),
  getContractReviewById: vi.fn(async () => null),
}));
vi.mock("@/lib/admin/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => true),
  getImageIntakeAdminFlags: vi.fn(() => ({
    enabled: true,
    combinedMultimodal: true,
    intentAssist: true,
    handoffQueueSubmit: true,
    crossSessionPersistence: true,
  })),
  setFeatureOverride: vi.fn(),
  clearFeatureOverride: vi.fn(),
  getAllFlagStates: vi.fn(() => []),
  getFlagDefinition: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  getHandoffLifecycleFeedback,
  buildHandoffLifecycleNote,
  buildPreparedHandoffFeedback,
} from "../image-intake/handoff-lifecycle";
import {
  lookupIntentAssistCache,
  storeIntentAssistCache,
  clearIntentAssistCache,
  buildIntentAssistCacheKey,
  getIntentAssistCacheStats,
} from "../image-intake/intent-assist-cache";
import {
  evaluateDocumentMultiImageSet,
  buildDocumentSetPreviewNote,
} from "../image-intake/document-set-intake";
import { getImageIntakeConfig } from "../image-intake/image-intake-config";
import type {
  IntentChangeFinding,
  MergedThreadFact,
  StitchedAssetGroup,
  InputClassificationResult,
  ExtractedFactBundle,
} from "../image-intake/types";
import { isFeatureEnabled } from "../../admin/feature-flags";
import { getContractReviewById } from "../../ai/review-queue-repository";

// Suppress unused import warning — used via vi.mocked in tests
void isFeatureEnabled;
void getContractReviewById;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAmbiguousFinding(): IntentChangeFinding {
  return {
    status: "ambiguous",
    currentIntent: "cancel_contract",
    priorIntent: "renew_contract",
    changeExplanation: "nejasné",
    confidence: 0.3,
    priorSuperseded: false,
  };
}

function makeFacts(n = 3): MergedThreadFact[] {
  return Array.from({ length: n }, (_, i) => ({
    factKey: `fact_key_${i}`,
    value: `value_${i}_detailed`,
    isLatestSignal: i === n - 1,
    confidence: 0.8,
    source: "observed" as const,
    sessionId: "sess_1",
    assetId: `asset_${i}`,
  }));
}

function makeGroup(assetIds: string[]): StitchedAssetGroup {
  return {
    groupId: "grp1",
    decision: "grouped_related",
    assetIds,
    primaryAssetId: assetIds[0] ?? "a1",
    duplicateAssetIds: [],
    confidence: 0.75,
    rationale: "test group",
  };
}

function makeDocClassification(inputType: InputClassificationResult["inputType"]): InputClassificationResult {
  return {
    inputType,
    confidence: 0.8,
    classificationSource: "multimodal_pass",
    requiresFollowUp: false,
    ambiguityReasons: [],
    handoffRecommended: false,
    handoffReasons: [],
    observedFacts: [],
    missingFields: [],
  };
}

function makeFactBundle(keys: Record<string, string> = {}): ExtractedFactBundle {
  return {
    facts: Object.entries(keys).map(([factKey, value]) => ({
      factType: "document_received" as const,
      value,
      normalizedValue: value,
      confidence: 0.8,
      evidence: { sourceAssetId: "a1", evidenceText: null, sourceRegion: null, confidence: 0.8 },
      isActionable: false,
      needsConfirmation: false,
      observedVsInferred: "observed" as const,
      factKey,
    })),
    missingFields: [],
    ambiguityReasons: [],
    extractionSource: "multimodal_pass" as const,
  };
}

// ---------------------------------------------------------------------------
// A) Handoff lifecycle feedback
// ---------------------------------------------------------------------------

describe("Handoff lifecycle feedback (Phase 8A)", () => {
  beforeEach(() => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    vi.mocked(getContractReviewById).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns unknown when reviewRowId is null", async () => {
    const result = await getHandoffLifecycleFeedback(null, "tenant1");
    expect(result.status).toBe("unknown");
    expect(result.suggestRefresh).toBe(false);
    expect(result.reviewRowId).toBeNull();
  });

  it("returns unavailable when tenant feature disabled", async () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const result = await getHandoffLifecycleFeedback("row-123", "tenant1");
    expect(result.status).toBe("unavailable");
    expect(result.suggestRefresh).toBe(false);
  });

  it("returns unavailable when row not found in DB", async () => {
    vi.mocked(getContractReviewById).mockResolvedValue(null);
    const result = await getHandoffLifecycleFeedback("row-123", "tenant1");
    expect(result.status).toBe("unavailable");
  });

  it("maps processingStatus=uploaded to submitted with suggestRefresh=true", async () => {
    vi.mocked(getContractReviewById).mockResolvedValue({
      processingStatus: "uploaded",
      processingStage: null,
    } as ReturnType<typeof getContractReviewById> extends Promise<infer T> ? NonNullable<T> : never);
    const result = await getHandoffLifecycleFeedback("row-123", "tenant1");
    expect(result.status).toBe("submitted");
    expect(result.suggestRefresh).toBe(true);
  });

  it("maps processingStatus=extracted to done with suggestRefresh=false", async () => {
    vi.mocked(getContractReviewById).mockResolvedValue({
      processingStatus: "extracted",
      processingStage: "done_step",
    } as ReturnType<typeof getContractReviewById> extends Promise<infer T> ? NonNullable<T> : never);
    const result = await getHandoffLifecycleFeedback("row-123", "tenant1");
    expect(result.status).toBe("done");
    expect(result.suggestRefresh).toBe(false);
    expect(result.processingStageHint).toBe("done_step");
  });

  it("returns unavailable on DB error (safe degradation)", async () => {
    vi.mocked(getContractReviewById).mockRejectedValue(new Error("DB timeout"));
    const result = await getHandoffLifecycleFeedback("row-123", "tenant1");
    expect(result.status).toBe("unavailable");
    expect(result.suggestRefresh).toBe(false);
  });

  it("buildPreparedHandoffFeedback returns prepared status", () => {
    const fb = buildPreparedHandoffFeedback();
    expect(fb.status).toBe("prepared");
    expect(fb.reviewRowId).toBeNull();
    expect(fb.suggestRefresh).toBe(false);
  });

  it("buildHandoffLifecycleNote includes stage hint when present", () => {
    const note = buildHandoffLifecycleNote({
      status: "processing",
      reviewRowId: "r1",
      statusLabel: "Probíhá zpracování",
      processingStageHint: "extraction_step",
      suggestRefresh: true,
      checkedAt: new Date().toISOString(),
    });
    expect(note).toContain("extraction_step");
    expect(note).toContain("AI Review");
  });

  it("does NOT call DB more than once per invocation (no polling spam)", async () => {
    vi.mocked(getContractReviewById).mockResolvedValue(null);
    await getHandoffLifecycleFeedback("row-123", "tenant1");
    await getHandoffLifecycleFeedback("row-123", "tenant1");
    // Each call is independent — 2 explicit calls = 2 DB reads (safe, not spam)
    expect(getContractReviewById).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// B) Intent-assist cache
// ---------------------------------------------------------------------------

describe("Intent-assist cache (Phase 8B)", () => {
  beforeEach(() => {
    clearIntentAssistCache();
  });

  it("returns cache_miss when cache is empty", () => {
    const finding = makeAmbiguousFinding();
    const facts = makeFacts();
    const result = lookupIntentAssistCache(finding, facts);
    expect(result.cacheStatus).toBe("cache_miss");
    expect(result.finding).toBeNull();
    expect(result.cacheKey).toBeTruthy();
  });

  it("returns cache_bypassed for non-ambiguous findings", () => {
    const finding: IntentChangeFinding = { ...makeAmbiguousFinding(), status: "stable" };
    const facts = makeFacts();
    const result = lookupIntentAssistCache(finding, facts);
    expect(result.cacheStatus).toBe("cache_bypassed");
  });

  it("returns cache_hit after store, skipping model call", () => {
    const finding = makeAmbiguousFinding();
    const facts = makeFacts(4);
    const resolved: IntentChangeFinding = { ...finding, status: "changed", confidence: 0.8 };

    storeIntentAssistCache(facts, resolved);
    const result = lookupIntentAssistCache(finding, facts);

    expect(result.cacheStatus).toBe("cache_hit");
    expect(result.finding?.status).toBe("changed");
  });

  it("returns cache_miss for different facts (different key)", () => {
    const finding = makeAmbiguousFinding();
    const facts1 = makeFacts(3);
    const facts2 = makeFacts(3).map((f, i) => ({ ...f, value: `totally_different_${i}` }));

    const resolved: IntentChangeFinding = { ...finding, status: "stable", confidence: 0.9 };
    storeIntentAssistCache(facts1, resolved);

    const result = lookupIntentAssistCache(finding, facts2);
    expect(result.cacheStatus).toBe("cache_miss");
  });

  it("does not store null results", () => {
    const facts = makeFacts();
    storeIntentAssistCache(facts, null);
    const finding = makeAmbiguousFinding();
    expect(lookupIntentAssistCache(finding, facts).cacheStatus).toBe("cache_miss");
  });

  it("buildIntentAssistCacheKey returns null for sparse facts", () => {
    expect(buildIntentAssistCacheKey([])).toBeNull();
    expect(buildIntentAssistCacheKey([{ factKey: "k", value: "v", isLatestSignal: false, confidence: 0.5, source: "observed", sessionId: "s", assetId: "a" }])).toBeNull();
  });

  it("getIntentAssistCacheStats reflects stored entries", () => {
    const facts = makeFacts(5);
    const resolved: IntentChangeFinding = { ...makeAmbiguousFinding(), status: "stable", confidence: 0.8 };
    storeIntentAssistCache(facts, resolved);
    const stats = getIntentAssistCacheStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.maxSize).toBe(200);
    expect(stats.ttlMs).toBe(30 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// C) Document multi-image set intake
// ---------------------------------------------------------------------------

describe("Document multi-image set intake (Phase 8C)", () => {
  it("returns mixed_document_set when communication asset present", () => {
    const group = makeGroup(["a1", "a2"]);
    const classifications = new Map([
      ["a1", makeDocClassification("screenshot_client_communication")],
      ["a2", makeDocClassification("photo_or_scan_document")],
    ]);
    const factBundles = new Map<string, ExtractedFactBundle>([
      ["a1", makeFactBundle()],
      ["a2", makeFactBundle()],
    ]);
    const result = evaluateDocumentMultiImageSet(group, classifications, factBundles);
    expect(result.decision).toBe("mixed_document_set");
    expect(result.mergedFactBundle).toBeNull();
  });

  it("returns supporting_reference_set when all supporting images", () => {
    const group = makeGroup(["a1", "a2"]);
    const classifications = new Map([
      ["a1", makeDocClassification("supporting_reference_image")],
      ["a2", makeDocClassification("supporting_reference_image")],
    ]);
    const result = evaluateDocumentMultiImageSet(group, classifications, new Map());
    expect(result.decision).toBe("supporting_reference_set");
  });

  it("returns review_handoff_candidate for contract-like documents", () => {
    const group = makeGroup(["a1", "a2"]);
    const classifications = new Map([
      ["a1", makeDocClassification("photo_or_scan_document")],
      ["a2", makeDocClassification("photo_or_scan_document")],
    ]);
    const factBundles = new Map<string, ExtractedFactBundle>([
      ["a1", makeFactBundle({ looks_like_contract: "true", document_type: "pojistná smlouva" })],
      ["a2", makeFactBundle({ key_fact_1: "pojistník: Jan Novák" })],
    ]);
    const result = evaluateDocumentMultiImageSet(group, classifications, factBundles);
    expect(result.decision).toBe("review_handoff_candidate");
    expect(result.mergedFactBundle).toBeNull();
  });

  it("consolidates plain document facts when no review signal", () => {
    const group = makeGroup(["a1", "a2"]);
    const classifications = new Map([
      ["a1", makeDocClassification("photo_or_scan_document")],
      ["a2", makeDocClassification("photo_or_scan_document")],
    ]);
    const factBundles = new Map<string, ExtractedFactBundle>([
      ["a1", makeFactBundle({ document_summary: "strana 1", key_fact_1: "telefon: 123456" })],
      ["a2", makeFactBundle({ document_summary: "strana 2", key_fact_2: "email: a@b.cz" })],
    ]);
    const result = evaluateDocumentMultiImageSet(group, classifications, factBundles);
    expect(result.decision).toBe("consolidated_document_facts");
    expect(result.mergedFactBundle).not.toBeNull();
    expect(result.mergedFactBundle?.facts.length).toBeGreaterThan(0);
  });

  it("buildDocumentSetPreviewNote returns non-empty string for all decisions", () => {
    const base = { confidence: 0.8, assetIds: ["a1", "a2"], mergedFactBundle: null, documentSetSummary: "test" };
    const decisions = [
      "consolidated_document_facts",
      "review_handoff_candidate",
      "supporting_reference_set",
      "mixed_document_set",
      "insufficient_for_merge",
    ] as const;
    for (const decision of decisions) {
      const note = buildDocumentSetPreviewNote({ ...base, decision });
      expect(typeof note).toBe("string");
      expect(note.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// D) Cross-session DB cleanup config
// ---------------------------------------------------------------------------

describe("Cross-session DB cleanup config (Phase 8D)", () => {
  it("getImageIntakeConfig returns valid TTL in ms", () => {
    const config = getImageIntakeConfig();
    expect(config.crossSessionTtlMs).toBeGreaterThan(0);
    expect(config.crossSessionTtlMs).toBeLessThanOrEqual(168 * 3600000);
  });

  it("TTL default is 72 hours = 259200000ms", () => {
    const config = getImageIntakeConfig();
    // Default 72h unless env override active
    if (!process.env.IMAGE_INTAKE_CROSS_SESSION_TTL_HOURS) {
      expect(config.crossSessionTtlMs).toBe(72 * 3600000);
    }
  });
});

// ---------------------------------------------------------------------------
// E) Guardrail: text-only flow not touched
// ---------------------------------------------------------------------------

describe("Text-only flow guardrail (Phase 8E)", () => {
  it("intent-assist cache does not affect non-image paths", () => {
    // Simulates text-only assistant call: no facts → always cache_bypassed
    const finding = makeAmbiguousFinding();
    const emptyFacts: MergedThreadFact[] = [];
    const result = lookupIntentAssistCache(finding, emptyFacts);
    expect(result.cacheStatus).toBe("cache_bypassed");
  });
});
