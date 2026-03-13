import { describe, it, expect, vi } from "vitest";
import { buildAssistantContext } from "../assistant-context";

vi.mock("../review-queue-repository", () => ({
  listContractReviews: vi.fn().mockResolvedValue([]),
}));

vi.mock("../dashboard-priority", () => ({
  computePriorityItems: vi.fn().mockResolvedValue([
    {
      type: "task",
      entityId: "t1",
      score: 1,
      severity: "high",
      title: "Urgent task",
      description: "Po termínu",
      recommendedAction: "Dokončit",
      source: "tasks",
    },
  ]),
}));

describe("assistant-context", () => {
  it("returns a non-empty string", async () => {
    const ctx = await buildAssistantContext("tenant-1");
    expect(typeof ctx).toBe("string");
    expect(ctx.length).toBeGreaterThan(0);
  });

  it("returns context under max length when options provided", async () => {
    const maxChars = 2000;
    const ctx = await buildAssistantContext("tenant-1", { maxChars });
    expect(ctx.length).toBeLessThanOrEqual(maxChars + 50);
  });

  it("does not include raw document content", async () => {
    const ctx = await buildAssistantContext("tenant-1");
    expect(ctx).not.toMatch(/base64|binary|pdf/);
  });
});
