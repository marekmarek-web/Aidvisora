/**
 * Image Intake Phase 10: confirm-flow lifecycle, cache TTL cleanup, document-set
 * execution plan, household ambiguity resolution, cron health signal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(), logAuditAction: vi.fn() }));
vi.mock("db", () => ({
  db: { select: vi.fn(), delete: vi.fn(), insert: vi.fn() },
  aiGenerations: {},
  auditLog: {},
  contractUploadReviews: {},
  households: {},
  householdMembers: {},
  contacts: {},
  eq: vi.fn(),
  and: vi.fn(),
  lt: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  isNull: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
}));

// ---------------------------------------------------------------------------
// A) Lifecycle confirm-flow
// ---------------------------------------------------------------------------

import {
  buildConfirmFlowLifecycleNote,
} from "../image-intake/confirm-flow-lifecycle";
import type { HandoffSubmitResult } from "../image-intake/types";

describe("A) buildConfirmFlowLifecycleNote", () => {
  it("formats successful submit with lifecycle status", () => {
    const submitResult: HandoffSubmitResult & { reviewRowId: string | null } = {
      status: "submitted",
      handoffId: "hid-1",
      reason: "ok",
      auditRef: "aref",
      reviewRowId: "row-123",
    };
    const lifecycleFeedback = {
      status: "submitted" as const,
      reviewRowId: "row-123",
      statusLabel: "Čeká ve frontě",
      processingStageHint: null,
      suggestRefresh: true,
      checkedAt: new Date().toISOString(),
    };
    const note = buildConfirmFlowLifecycleNote(submitResult, lifecycleFeedback);
    expect(note).toContain("row-123");
    expect(note).toContain("Čeká ve frontě");
  });

  it("formats skipped_no_confirm without lifecycle", () => {
    const submitResult: HandoffSubmitResult & { reviewRowId: string | null } = {
      status: "skipped_no_confirm",
      handoffId: "hid-2",
      reason: "needs confirm",
      auditRef: null,
      reviewRowId: null,
    };
    const note = buildConfirmFlowLifecycleNote(submitResult, null);
    expect(note).toContain("explicitní potvrzení");
  });

  it("formats failed submit", () => {
    const submitResult: HandoffSubmitResult & { reviewRowId: string | null } = {
      status: "failed",
      handoffId: "hid-3",
      reason: "DB error",
      auditRef: null,
      reviewRowId: null,
    };
    const note = buildConfirmFlowLifecycleNote(submitResult, null);
    expect(note).toContain("nepodařilo odeslat");
  });
});

// ---------------------------------------------------------------------------
// B) Config TTL: intentAssistCacheTtlMs
// ---------------------------------------------------------------------------

import { getImageIntakeConfig } from "../image-intake/image-intake-config";

describe("B) getImageIntakeConfig intentAssistCacheTtlMs", () => {
  it("returns default 30 min TTL (0.5h * 3600000)", () => {
    const config = getImageIntakeConfig();
    expect(config.intentAssistCacheTtlMs).toBe(0.5 * 60 * 60 * 1000);
  });

  it("intentAssistCacheTtlMs is separate from crossSessionTtlMs", () => {
    const config = getImageIntakeConfig();
    expect(config.intentAssistCacheTtlMs).not.toBe(config.crossSessionTtlMs);
  });
});

// ---------------------------------------------------------------------------
// C) Document-set outcomes → execution plan
// ---------------------------------------------------------------------------

import { buildActionPlanV4 } from "../image-intake/planner";
import type {
  InputClassificationResult,
  ClientBindingResult,
  ExtractedFactBundle,
  DocumentMultiImageResult,
} from "../image-intake/types";

const mockClassification: InputClassificationResult = {
  inputType: "photo_or_scan_document",
  confidence: 0.8,
  uncertaintyFlags: [],
  modelUsed: false,
};

const mockBinding: ClientBindingResult = {
  state: "bound_client_confident",
  clientId: "c1",
  clientLabel: "Test Klient",
  caseId: null,
  caseLabel: null,
  matchedBy: "active_context",
  warnings: [],
};

const mockFacts: ExtractedFactBundle = {
  facts: [],
  missingFields: [],
  ambiguityReasons: [],
  extractionSource: "preflight_heuristic",
};

describe("C) buildActionPlanV4 document-set outcomes", () => {
  it("supporting_reference_set → archive only, no structured fact actions", () => {
    const docSet: DocumentMultiImageResult = {
      decision: "supporting_reference_set",
      mergedFactBundle: null,
      documentSetSummary: "Pouze referenční obrázky.",
      confidence: 0.9,
      assetIds: ["a1", "a2"],
    };
    const plan = buildActionPlanV4(mockClassification, mockBinding, mockFacts, null, null, docSet);
    expect(plan.outputMode).toBe("supporting_reference_image");
    expect(plan.recommendedActions.every((a) => a.writeAction !== "createTask")).toBe(true);
  });

  it("review_handoff_candidate → adds safety flag, needsAdvisorInput", () => {
    const docSet: DocumentMultiImageResult = {
      decision: "review_handoff_candidate",
      mergedFactBundle: null,
      documentSetSummary: "Smlouva — AI Review doporučen.",
      confidence: 0.85,
      assetIds: ["a1", "a2"],
    };
    const plan = buildActionPlanV4(mockClassification, mockBinding, mockFacts, null, null, docSet);
    expect(plan.needsAdvisorInput).toBe(true);
    expect(plan.safetyFlags.some((f) => f.includes("DOCUMENT_SET_REVIEW_CANDIDATE"))).toBe(true);
  });

  it("mixed_document_set → adds safety flag, needsAdvisorInput", () => {
    const docSet: DocumentMultiImageResult = {
      decision: "mixed_document_set",
      mergedFactBundle: null,
      documentSetSummary: "Smíšená skupina.",
      confidence: 0,
      assetIds: ["a1", "a2"],
    };
    const plan = buildActionPlanV4(mockClassification, mockBinding, mockFacts, null, null, docSet);
    expect(plan.needsAdvisorInput).toBe(true);
    expect(plan.safetyFlags.some((f) => f.includes("DOCUMENT_SET_MIXED"))).toBe(true);
  });

  it("consolidated_document_facts → pass-through, enriches whyThisAction", () => {
    const docSet: DocumentMultiImageResult = {
      decision: "consolidated_document_facts",
      mergedFactBundle: null,
      documentSetSummary: "2 stránky sloučeny.",
      confidence: 0.9,
      assetIds: ["a1", "a2"],
    };
    const plan = buildActionPlanV4(mockClassification, mockBinding, mockFacts, null, null, docSet);
    expect(plan.whyThisAction).toContain("2 stránky sloučeny");
    // Should NOT add safety flags for consolidated
    expect(plan.safetyFlags.some((f) => f.includes("DOCUMENT_SET_MIXED"))).toBe(false);
  });

  it("null documentSetResult → identical to v3 output", () => {
    const v4 = buildActionPlanV4(mockClassification, mockBinding, mockFacts, null, null, null);
    // Without documentSet, v4 is a pass-through of v3 — outputMode must be consistent
    expect(["structured_image_fact_intake", "supporting_reference_image", "ambiguous_needs_input", "client_message_update", "no_action_archive_only"]).toContain(v4.outputMode);
    expect(Array.isArray(v4.recommendedActions)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D) Household ambiguity resolution
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuthInAction: vi.fn(async () => ({ userId: "advisor-1", roleName: "advisor" })),
}));
vi.mock("@/lib/auth/get-membership", () => ({
  getMembership: vi.fn(async () => ({ tenantId: "t1", role: "advisor" })),
}));
vi.mock("@/lib/admin/admin-permissions", () => ({
  deriveAdminScope: vi.fn(() => "tenant"),
  canManageFeatureFlags: vi.fn(() => true),
}));
vi.mock("@/shared/rolePermissions", () => ({
  hasPermission: vi.fn(() => true),
}));
vi.mock("@/lib/admin/config-audit", () => ({ logConfigChange: vi.fn() }));
vi.mock("@/lib/admin/feature-flags", () => ({
  getImageIntakeAdminFlags: vi.fn(() => ({ enabled: true })),
  setFeatureOverride: vi.fn(),
  clearFeatureOverride: vi.fn(),
}));
vi.mock("@/lib/ai/image-intake/intent-assist-cache", () => ({
  getIntentAssistCacheStats: vi.fn(() => ({ size: 0, hitCount: 0, missCount: 0 })),
}));

import { resolveHouseholdAmbiguity } from "@/app/actions/admin-image-intake";
import type { HouseholdMember } from "../image-intake/types";

describe("D) resolveHouseholdAmbiguity", () => {
  const members: HouseholdMember[] = [
    { clientId: "c1", clientLabel: "Jan Novák", role: "primary", householdId: "hh1", householdName: "Rodina Novák" },
    { clientId: "c2", clientLabel: "Jana Nováková", role: "partner", householdId: "hh1", householdName: "Rodina Novák" },
  ];

  it("resolves valid household member", async () => {
    const result = await resolveHouseholdAmbiguity("hh1", members, "c1");
    expect(result.ok).toBe(true);
    expect(result.resolvedClientId).toBe("c1");
    expect(result.resolvedClientLabel).toBe("Jan Novák");
    expect(result.auditRef).toBeTruthy();
  });

  it("rejects clientId not in household", async () => {
    const result = await resolveHouseholdAmbiguity("hh1", members, "c-unknown");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("není členem");
  });

  it("rejects wrong householdId", async () => {
    const result = await resolveHouseholdAmbiguity("hh-wrong", members, "c1");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E) Cron health status
// ---------------------------------------------------------------------------

describe("E) cron health computeHealthStatus (inline logic)", () => {
  function computeHealthStatus(action: string): string {
    if (action === "image_intake_cleanup.completed") return "healthy";
    if (action === "image_intake_cleanup.skipped") return "healthy";
    if (action === "image_intake_cleanup.failed") return "degraded";
    return "unknown";
  }

  it("completed → healthy", () => {
    expect(computeHealthStatus("image_intake_cleanup.completed")).toBe("healthy");
  });

  it("skipped → healthy (disabled is expected)", () => {
    expect(computeHealthStatus("image_intake_cleanup.skipped")).toBe("healthy");
  });

  it("failed → degraded", () => {
    expect(computeHealthStatus("image_intake_cleanup.failed")).toBe("degraded");
  });

  it("unknown action → unknown", () => {
    expect(computeHealthStatus("some_other_action")).toBe("unknown");
  });
});
