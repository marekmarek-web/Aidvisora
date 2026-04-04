/**
 * P6: in-process assistant metrics bump alongside audit telemetry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/audit", () => ({
  logAuditAction: vi.fn(),
}));

import { resetAssistantMetricsForTests, getAssistantMetricsSnapshot } from "../assistant-metrics";
import { logAssistantTelemetry, AssistantTelemetryAction } from "../assistant-telemetry";

beforeEach(() => {
  resetAssistantMetricsForTests();
});

describe("assistant-metrics", () => {
  it("increments when telemetry fires even without run store", () => {
    logAssistantTelemetry(AssistantTelemetryAction.RUN_START);
    const snap = getAssistantMetricsSnapshot();
    expect(snap[AssistantTelemetryAction.RUN_START]).toBe(1);
  });
});
