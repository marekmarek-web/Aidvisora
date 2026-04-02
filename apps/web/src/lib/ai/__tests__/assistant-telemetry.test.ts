import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/audit", () => ({
  logAuditAction: vi.fn(),
}));

describe("assistant telemetry", () => {
  it("logAssistantTelemetry is a no-op without run store", async () => {
    const { logAuditAction } = await import("@/lib/audit");
    const { logAssistantTelemetry, AssistantTelemetryAction } = await import("../assistant-telemetry");
    logAssistantTelemetry(AssistantTelemetryAction.RUN_START);
    expect(logAuditAction).not.toHaveBeenCalled();
  });
});
