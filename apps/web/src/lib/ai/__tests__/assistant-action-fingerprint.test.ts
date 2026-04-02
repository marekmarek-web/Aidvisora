/**
 * Phase 2C: unit tests for action fingerprinting and duplicate detection.
 */

import { describe, it, expect } from "vitest";

import {
  computeStepFingerprint,
  checkRecentFingerprint,
  recordFingerprint,
} from "../assistant-action-fingerprint";
import type { ExecutionStep } from "../assistant-domain-model";

function makeStep(action: string, params: Record<string, unknown>): ExecutionStep {
  return {
    stepId: `step_${Math.random().toString(36).slice(2, 10)}`,
    action: action as any,
    params,
    label: "test",
    requiresConfirmation: false,
    isReadOnly: false,
    dependsOn: [],
    status: "confirmed",
    result: null,
  };
}

describe("computeStepFingerprint", () => {
  it("same params produce same fingerprint", () => {
    const a = makeStep("createTask", { contactId: "c1", taskTitle: "Follow-up" });
    const b = makeStep("createTask", { contactId: "c1", taskTitle: "Follow-up" });
    expect(computeStepFingerprint(a)).toBe(computeStepFingerprint(b));
  });

  it("different params produce different fingerprints", () => {
    const a = makeStep("createTask", { contactId: "c1", taskTitle: "Follow-up" });
    const b = makeStep("createTask", { contactId: "c2", taskTitle: "Follow-up" });
    expect(computeStepFingerprint(a)).not.toBe(computeStepFingerprint(b));
  });

  it("ignores stepId differences", () => {
    const a = { ...makeStep("createOpportunity", { contactId: "c1" }), stepId: "step_aaa" };
    const b = { ...makeStep("createOpportunity", { contactId: "c1" }), stepId: "step_bbb" };
    expect(computeStepFingerprint(a)).toBe(computeStepFingerprint(b));
  });
});

describe("checkRecentFingerprint / recordFingerprint", () => {
  it("returns not duplicate for unseen fingerprint", () => {
    const result = checkRecentFingerprint("sess-new", "fp-never-seen");
    expect(result.isDuplicate).toBe(false);
  });

  it("detects duplicate after recording", () => {
    const session = "sess-dedup-test";
    const fp = "fp-recorded";
    recordFingerprint(session, fp, "action-123");
    const result = checkRecentFingerprint(session, fp);
    expect(result.isDuplicate).toBe(true);
    expect(result.existingActionId).toBe("action-123");
  });

  it("does not cross sessions", () => {
    const fp = "fp-cross-session";
    recordFingerprint("sess-A", fp, "a-1");
    const result = checkRecentFingerprint("sess-B", fp);
    expect(result.isDuplicate).toBe(false);
  });
});
