/**
 * Phase 3H: unit tests for assistant-execution-ui shared helpers.
 * Covers badge info, outcome summary, and parity between drawer/mobile rendering logic.
 */
import { describe, it, expect } from "vitest";
import {
  getExecutionStatusInfo,
  getStepOutcomeStatusLabel,
  hasAnyFailure,
  buildOutcomeSummaryLine,
  type StepOutcomeSummary,
} from "../assistant-execution-ui";

// ─── getExecutionStatusInfo ───────────────────────────────────────────────────

describe("getExecutionStatusInfo", () => {
  it("awaiting_confirmation → amber tone", () => {
    const info = getExecutionStatusInfo("awaiting_confirmation");
    expect(info.tone).toBe("amber");
    expect(info.text).toBe("Čeká na potvrzení");
    expect(info.badgeClassName).toContain("amber");
  });

  it("completed → emerald tone", () => {
    const info = getExecutionStatusInfo("completed");
    expect(info.tone).toBe("emerald");
    expect(info.text).toBe("Provedeno");
    expect(info.badgeClassName).toContain("emerald");
  });

  it("partial_failure → rose tone", () => {
    const info = getExecutionStatusInfo("partial_failure");
    expect(info.tone).toBe("rose");
    expect(info.badgeClassName).toContain("rose");
  });

  it("executing → indigo tone", () => {
    const info = getExecutionStatusInfo("executing");
    expect(info.tone).toBe("indigo");
  });

  it("draft → slate tone", () => {
    const info = getExecutionStatusInfo("draft");
    expect(info.tone).toBe("slate");
  });

  it("all statuses return non-empty text and badgeClassName", () => {
    const statuses = ["draft", "awaiting_confirmation", "executing", "completed", "partial_failure"] as const;
    for (const s of statuses) {
      const info = getExecutionStatusInfo(s);
      expect(info.text.length).toBeGreaterThan(0);
      expect(info.badgeClassName.length).toBeGreaterThan(0);
    }
  });
});

// ─── getStepOutcomeStatusLabel ────────────────────────────────────────────────

describe("getStepOutcomeStatusLabel", () => {
  it("returns Czech labels for each status", () => {
    expect(getStepOutcomeStatusLabel("succeeded")).toBe("Provedeno");
    expect(getStepOutcomeStatusLabel("failed")).toBe("Selhalo");
    expect(getStepOutcomeStatusLabel("skipped")).toBe("Přeskočeno");
    expect(getStepOutcomeStatusLabel("idempotent_hit")).toBe("Již existuje");
  });
});

// ─── hasAnyFailure ─────────────────────────────────────────────────────────────

describe("hasAnyFailure", () => {
  const succeeded: StepOutcomeSummary = { label: "OK", status: "succeeded" };
  const failed: StepOutcomeSummary = { label: "Fail", status: "failed" };
  const skipped: StepOutcomeSummary = { label: "Skip", status: "skipped" };

  it("returns false when all outcomes succeeded", () => {
    expect(hasAnyFailure([succeeded, succeeded])).toBe(false);
  });

  it("returns true when one outcome failed", () => {
    expect(hasAnyFailure([succeeded, failed])).toBe(true);
  });

  it("returns true when hasPartialFailure flag is set, even without failed outcomes", () => {
    expect(hasAnyFailure([succeeded, skipped], true)).toBe(true);
  });

  it("returns false for empty array", () => {
    expect(hasAnyFailure([])).toBe(false);
  });

  it("idempotent_hit does not count as failure", () => {
    const hit: StepOutcomeSummary = { label: "Hit", status: "idempotent_hit" };
    expect(hasAnyFailure([hit])).toBe(false);
  });
});

// ─── buildOutcomeSummaryLine ──────────────────────────────────────────────────

describe("buildOutcomeSummaryLine", () => {
  it("all succeeded → shows succeeded/total format", () => {
    const outcomes: StepOutcomeSummary[] = [
      { label: "A", status: "succeeded" },
      { label: "B", status: "succeeded" },
    ];
    expect(buildOutcomeSummaryLine(outcomes)).toMatch(/2 \/ 2 kroků/);
  });

  it("some failed → shows failed/total format", () => {
    const outcomes: StepOutcomeSummary[] = [
      { label: "A", status: "succeeded" },
      { label: "B", status: "failed" },
    ];
    const line = buildOutcomeSummaryLine(outcomes);
    expect(line).toMatch(/1 z 2 kroků selhalo/);
  });

  it("mixed with skipped and idempotent_hit → only failed count matters", () => {
    const outcomes: StepOutcomeSummary[] = [
      { label: "A", status: "succeeded" },
      { label: "B", status: "skipped" },
      { label: "C", status: "idempotent_hit" },
    ];
    expect(buildOutcomeSummaryLine(outcomes)).toMatch(/1 \/ 3/);
  });
});

// ─── PARITY: drawer vs mobile use same status badge classes ──────────────────

describe("Drawer / mobile parity — status badge classes", () => {
  it("awaiting_confirmation badge class contains both border and bg tokens", () => {
    const { badgeClassName } = getExecutionStatusInfo("awaiting_confirmation");
    expect(badgeClassName).toMatch(/border-amber/);
    expect(badgeClassName).toMatch(/bg-amber/);
    expect(badgeClassName).toMatch(/text-amber/);
  });

  it("completed badge class is emerald across both surfaces", () => {
    const { badgeClassName } = getExecutionStatusInfo("completed");
    expect(badgeClassName).not.toMatch(/amber/);
    expect(badgeClassName).toMatch(/emerald/);
  });

  it("partial_failure badge class is rose", () => {
    const { badgeClassName } = getExecutionStatusInfo("partial_failure");
    expect(badgeClassName).toMatch(/rose/);
    expect(badgeClassName).not.toMatch(/emerald/);
  });
});
