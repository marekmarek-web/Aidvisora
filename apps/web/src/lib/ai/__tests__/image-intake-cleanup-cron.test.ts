/**
 * Image intake cleanup crons — audit + webhook sequencing (Phase 11 / cleanup plan).
 * Tests GET handlers with mocked db, config, cron auth.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAuditAction } from "@/lib/audit";
import { sendCronHealthWebhook } from "@/lib/ai/image-intake/cron-webhook";

vi.mock("@/lib/cron-auth", () => ({
  cronAuthResponse: vi.fn(() => null),
}));

vi.mock("@/lib/audit", () => ({
  logAuditAction: vi.fn(),
}));

vi.mock("@/lib/ai/image-intake/cron-webhook", () => ({
  sendCronHealthWebhook: vi.fn(async () => true),
}));

const mockConfig = vi.hoisted(() => ({
  crossSessionTtlMs: 72 * 60 * 60 * 1000,
  crossSessionMaxArtifacts: 20,
  combinedPassMaxImages: 3,
  intentAssistThreshold: 0.45,
  intentAssistEnabled: false,
  intentAssistCacheTtlMs: 30 * 60 * 1000,
  crossSessionPersistenceEnabled: true,
  handoffQueueSubmitEnabled: false,
  cacheCleanupIntervalHours: 2,
}));

vi.mock("@/lib/ai/image-intake/image-intake-config", () => ({
  getImageIntakeConfig: () => ({ ...mockConfig }),
}));

const cronDbMocks = vi.hoisted(() => {
  const whereMock = vi.fn();
  const deleteMock = vi.fn(() => ({ where: whereMock }));
  return { whereMock, deleteMock };
});

vi.mock("db", () => ({
  db: {
    delete: cronDbMocks.deleteMock,
  },
  aiGenerations: {},
  eq: vi.fn(),
  and: vi.fn(),
  lt: vi.fn(),
}));

import { GET as getMainCleanup } from "@/app/api/cron/image-intake-cleanup/route";
import { GET as getCacheCleanup } from "@/app/api/cron/image-intake-cache-cleanup/route";

const req = new Request("http://localhost/api/cron/test");

describe("image-intake-cleanup (daily)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.crossSessionPersistenceEnabled = true;
    cronDbMocks.whereMock.mockReset();
    cronDbMocks.whereMock
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 5 });
  });

  it("skipped: logs image_intake_cleanup.skipped and webhook skipped", async () => {
    mockConfig.crossSessionPersistenceEnabled = false;
    const res = await getMainCleanup(req);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "image_intake_cleanup.skipped" }),
    );
    expect(sendCronHealthWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ job: "image_intake_cleanup", status: "skipped" }),
    );
  });

  it("ok: started → two deletes → completed + webhook ok", async () => {
    const res = await getMainCleanup(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deletedArtifacts).toBe(2);
    expect(body.deletedCache).toBe(5);
    expect(body.totalDeleted).toBe(7);
    const actions = vi.mocked(logAuditAction).mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(["image_intake_cleanup.started", "image_intake_cleanup.completed"]);
    expect(sendCronHealthWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ job: "image_intake_cleanup", status: "ok", totalDeleted: 7 }),
    );
  });

  it("fail: logs failed + webhook failed + 500", async () => {
    cronDbMocks.whereMock.mockReset();
    cronDbMocks.whereMock.mockRejectedValueOnce(new Error("db boom"));
    const res = await getMainCleanup(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "image_intake_cleanup.failed" }),
    );
    expect(sendCronHealthWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ job: "image_intake_cleanup", status: "failed" }),
    );
  });
});

describe("image-intake-cache-cleanup (2h)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.crossSessionPersistenceEnabled = true;
    cronDbMocks.whereMock.mockReset();
    cronDbMocks.whereMock.mockResolvedValue({ rowCount: 4 });
  });

  it("skipped: logs image_intake_cache_cleanup.skipped + webhook skipped", async () => {
    mockConfig.crossSessionPersistenceEnabled = false;
    const res = await getCacheCleanup(req);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "image_intake_cache_cleanup.skipped",
        meta: expect.objectContaining({
          reason: "cross_session_persistence_enabled=false",
          cacheTtlHours: 0.5,
        }),
      }),
    );
    expect(sendCronHealthWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ job: "image_intake_cache_cleanup", status: "skipped" }),
    );
  });

  it("ok: started → delete → completed + webhook ok", async () => {
    const res = await getCacheCleanup(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deletedCache).toBe(4);
    const actions = vi.mocked(logAuditAction).mock.calls.map((c) => c[0].action);
    expect(actions).toEqual([
      "image_intake_cache_cleanup.started",
      "image_intake_cache_cleanup.completed",
    ]);
    expect(sendCronHealthWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        job: "image_intake_cache_cleanup",
        status: "ok",
        deletedCache: 4,
      }),
    );
  });

  it("fail: logs failed + webhook failed", async () => {
    cronDbMocks.whereMock.mockReset();
    cronDbMocks.whereMock.mockRejectedValueOnce(new Error("cache delete failed"));
    const res = await getCacheCleanup(req);
    expect(res.status).toBe(500);
    expect(logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "image_intake_cache_cleanup.failed" }),
    );
    expect(sendCronHealthWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ job: "image_intake_cache_cleanup", status: "failed" }),
    );
  });
});
