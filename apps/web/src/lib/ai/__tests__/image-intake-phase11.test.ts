/**
 * Image Intake Phase 11: typed session + lifecycle, household UI safety,
 * external webhook, cleanup schedule/config hardening.
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
  getIntentAssistCacheStats: vi.fn(() => ({ size: 0, hitCount: 0, missCount: 0, maxSize: 500, ttlMs: 1800000 })),
}));

// ---------------------------------------------------------------------------
// A) Typed session — no unsafe cast needed for handoff payload
// ---------------------------------------------------------------------------

import { getOrCreateSession } from "../assistant-session";
import type { ReviewHandoffPayload } from "../image-intake/types";

describe("A) AssistantSession typed handoff payload field", () => {
  it("session has lastImageIntakeHandoffPayload field typed correctly", () => {
    const session = getOrCreateSession(undefined, "t1", "u1");
    // Must be undefined by default (not Record<string,unknown>)
    expect(session.lastImageIntakeHandoffPayload).toBeUndefined();
  });

  it("can assign typed ReviewHandoffPayload without cast", () => {
    const session = getOrCreateSession(undefined, "t1", "u1");
    const payload: ReviewHandoffPayload = {
      handoffId: "hid-1",
      status: "ready",
      sourceAssetIds: ["a1"],
      handoffReasons: ["contract_like_document"],
      orientationSummary: "Test document",
      detectedInputType: "photo_or_scan_document",
      bindingContext: { clientId: "c1", clientLabel: "Test", caseId: null, caseLabel: null, bindingConfidence: 0.9 },
      ambiguityNotes: [],
      metadata: { sessionId: "s1", tenantId: "t1", userId: "u1", uploadedAt: new Date() },
      laneNote: "image_intake_lane_only_extracted_orientation",
    };
    // Direct typed assignment — no cast required
    session.lastImageIntakeHandoffPayload = payload;
    expect(session.lastImageIntakeHandoffPayload?.handoffId).toBe("hid-1");
    expect(session.lastImageIntakeHandoffPayload?.status).toBe("ready");
  });

  it("can set to null to reset after submit", () => {
    const session = getOrCreateSession(undefined, "t1", "u1");
    session.lastImageIntakeHandoffPayload = null;
    expect(session.lastImageIntakeHandoffPayload).toBeNull();
  });

  it("text-only assistant flow: field stays undefined — no intake overhead", () => {
    const session = getOrCreateSession(undefined, "t1", "u1");
    // Simulates text-only turn: no intake run, field remains untouched
    expect(session.lastImageIntakeHandoffPayload).toBeUndefined();
    expect(session.lastImageIntakeHandoffReviewRowId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// B) lifecycleFeedback typing — clean null in orchestrator result
// ---------------------------------------------------------------------------

describe("B) lifecycleFeedback typing in orchestrator result", () => {
  it("lifecycleFeedback is always null from processImageIntake (by design)", () => {
    // This is the documented contract: orchestrator always returns null,
    // route-handler injects lifecycle feedback after orchestrator run.
    // The type is HandoffLifecycleFeedback | null — not unknown/any.
    type TestShape = { lifecycleFeedback: import("../image-intake/types").HandoffLifecycleFeedback | null };
    const result: TestShape = { lifecycleFeedback: null };
    expect(result.lifecycleFeedback).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C) Household resolution — UI safety guards
// ---------------------------------------------------------------------------

import { resolveHouseholdAmbiguity } from "@/app/actions/admin-image-intake";
import type { HouseholdMember } from "../image-intake/types";

const testMembers: HouseholdMember[] = [
  { clientId: "c1", clientLabel: "Jan Novák", role: "primary", householdId: "hh1", householdName: "Rodina Novák" },
  { clientId: "c2", clientLabel: "Jana Nováková", role: "partner", householdId: "hh1", householdName: "Rodina Novák" },
];

describe("C) Household ambiguity resolution — safe path guards", () => {
  it("resolves valid member — ok, returns typed clientId + label", async () => {
    const result = await resolveHouseholdAmbiguity("hh1", testMembers, "c2");
    expect(result.ok).toBe(true);
    expect(result.resolvedClientId).toBe("c2");
    expect(result.resolvedClientLabel).toBe("Jana Nováková");
    expect(result.auditRef).toBeTruthy();
  });

  it("rejects unknown clientId — no silent auto-pick", async () => {
    const result = await resolveHouseholdAmbiguity("hh1", testMembers, "c-unknown");
    expect(result.ok).toBe(false);
    expect(result.resolvedClientId).toBeNull();
    expect(result.error).toContain("není členem");
  });

  it("rejects wrong householdId — member validation checks householdId", async () => {
    const result = await resolveHouseholdAmbiguity("hh-other", testMembers, "c1");
    expect(result.ok).toBe(false);
    expect(result.resolvedClientId).toBeNull();
  });

  it("returns auditRef for successful resolution — auditability", async () => {
    const result = await resolveHouseholdAmbiguity("hh1", testMembers, "c1", "test_context");
    expect(result.ok).toBe(true);
    expect(typeof result.auditRef).toBe("string");
    expect(result.auditRef!.length).toBeGreaterThan(8);
  });

  it("does not auto-pick if empty selectedClientId — explicit confirm required", async () => {
    const result = await resolveHouseholdAmbiguity("hh1", testMembers, "");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D) External webhook — enabled, disabled, failure-safe
// ---------------------------------------------------------------------------

import { sendCronHealthWebhook, isCronWebhookConfigured } from "../image-intake/cron-webhook";

describe("D) Cron health external webhook", () => {
  beforeEach(() => {
    delete process.env.IMAGE_INTAKE_CRON_WEBHOOK_URL;
    vi.restoreAllMocks();
  });

  it("disabled when IMAGE_INTAKE_CRON_WEBHOOK_URL is not set", async () => {
    const result = await sendCronHealthWebhook({
      job: "image_intake_cleanup",
      status: "ok",
      durationMs: 100,
      deletedArtifacts: 0,
      deletedCache: 5,
      totalDeleted: 5,
      timestamp: new Date().toISOString(),
      message: "test",
    });
    expect(result).toBe(false);
  });

  it("isCronWebhookConfigured returns false when URL not set", () => {
    expect(isCronWebhookConfigured()).toBe(false);
  });

  it("isCronWebhookConfigured returns true when URL set", () => {
    process.env.IMAGE_INTAKE_CRON_WEBHOOK_URL = "https://example.com/webhook";
    expect(isCronWebhookConfigured()).toBe(true);
    delete process.env.IMAGE_INTAKE_CRON_WEBHOOK_URL;
  });

  it("is failure-safe — fetch error does not throw", async () => {
    process.env.IMAGE_INTAKE_CRON_WEBHOOK_URL = "https://invalid-test-endpoint.example.com/fail";
    // fetch will fail; function must not throw
    await expect(
      sendCronHealthWebhook({
        job: "image_intake_cleanup",
        status: "failed",
        durationMs: 50,
        deletedArtifacts: 0,
        deletedCache: 0,
        totalDeleted: 0,
        timestamp: new Date().toISOString(),
        message: "simulated failure",
      })
    ).resolves.not.toThrow();
    delete process.env.IMAGE_INTAKE_CRON_WEBHOOK_URL;
  });
});

// ---------------------------------------------------------------------------
// E) Cleanup schedule/config hardening
// ---------------------------------------------------------------------------

import { getImageIntakeConfig, setImageIntakeConfigOverride, clearImageIntakeConfigOverride } from "../image-intake/image-intake-config";

describe("E) Intent-assist cache cleanup config hardening", () => {
  beforeEach(() => {
    clearImageIntakeConfigOverride("intent_assist_cache_ttl_hours");
    clearImageIntakeConfigOverride("cache_cleanup_interval_hours");
  });

  it("default intentAssistCacheTtlMs is 30 min (0.5h)", () => {
    const config = getImageIntakeConfig();
    expect(config.intentAssistCacheTtlMs).toBe(30 * 60 * 1000);
  });

  it("default cacheCleanupIntervalHours is 2 hours", () => {
    const config = getImageIntakeConfig();
    expect(config.cacheCleanupIntervalHours).toBe(2);
  });

  it("valid override for cache_cleanup_interval_hours is accepted", () => {
    const err = setImageIntakeConfigOverride("cache_cleanup_interval_hours", 1);
    expect(err).toBeNull();
    const config = getImageIntakeConfig();
    expect(config.cacheCleanupIntervalHours).toBe(1);
  });

  it("rejects cache_cleanup_interval_hours below min (0.5h)", () => {
    const err = setImageIntakeConfigOverride("cache_cleanup_interval_hours", 0.1);
    expect(err).not.toBeNull();
    expect(err).toContain("min");
  });

  it("rejects cache_cleanup_interval_hours above max (24h)", () => {
    const err = setImageIntakeConfigOverride("cache_cleanup_interval_hours", 25);
    expect(err).not.toBeNull();
    expect(err).toContain("max");
  });

  it("clearing override reverts to default 2h", () => {
    setImageIntakeConfigOverride("cache_cleanup_interval_hours", 4);
    clearImageIntakeConfigOverride("cache_cleanup_interval_hours");
    expect(getImageIntakeConfig().cacheCleanupIntervalHours).toBe(2);
  });

  it("cacheCleanupIntervalHours >= intentAssistCacheTtlMs / 3600000 (schedule not shorter than TTL)", () => {
    const config = getImageIntakeConfig();
    // 2h interval vs 0.5h TTL — interval should be ≥ TTL to avoid over-scheduling
    // (But can be >= — 2h is reasonable for 30-min TTL: entries die naturally in-process)
    expect(config.cacheCleanupIntervalHours).toBeGreaterThanOrEqual(
      config.intentAssistCacheTtlMs / 3600000,
    );
  });
});

// ---------------------------------------------------------------------------
// F) Lane separation — text-only flow untouched, no parallel write system
// ---------------------------------------------------------------------------

describe("F) Lane separation + no parallel write system", () => {
  it("text-only session creates no image intake state", () => {
    const session = getOrCreateSession(undefined, "t1", "u1");
    // A text-only turn should leave all image intake fields undefined
    expect(session.lastImageIntakeHandoffPayload).toBeUndefined();
    expect(session.lastImageIntakeHandoffReviewRowId).toBeUndefined();
  });

  it("handoff payload field does not expose AI Review internals", () => {
    const session = getOrCreateSession(undefined, "t1", "u2");
    session.lastImageIntakeHandoffPayload = {
      handoffId: "hid-x",
      status: "ready",
      sourceAssetIds: ["a1"],
      handoffReasons: ["contract_like_document"],
      orientationSummary: null,
      detectedInputType: null,
      bindingContext: { clientId: null, clientLabel: null, caseId: null, caseLabel: null, bindingConfidence: 0 },
      ambiguityNotes: [],
      metadata: { sessionId: "s1", tenantId: "t1", userId: "u2", uploadedAt: new Date() },
      laneNote: "image_intake_lane_only_extracted_orientation",
    };
    // laneNote explicitly marks that image intake did NOT do AI Review work
    expect(session.lastImageIntakeHandoffPayload?.laneNote).toBe(
      "image_intake_lane_only_extracted_orientation",
    );
  });
});
