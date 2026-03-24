import { describe, it, expect } from "vitest";
import {
  scorePriorityItem,
  scoreToSeverity,
  enrichUrgentItem,
  buildDeterministicSummary,
  type PriorityItem,
} from "../priority-scoring";
import type { UrgentItem } from "../dashboard-types";

describe("scorePriorityItem", () => {
  it("returns 0 for no flags", () => {
    expect(scorePriorityItem({})).toBe(0);
  });

  it("sums overdue task and payment blocked", () => {
    const score = scorePriorityItem({
      isOverdueTask: true,
      isPaymentBlocked: true,
    });
    expect(score).toBeCloseTo(0.5);
  });

  it("caps at 1.0 when all flags set", () => {
    const score = scorePriorityItem({
      isOverdueTask: true,
      isReviewPendingOld: true,
      isPaymentBlocked: true,
      isLowConfidenceApply: true,
      isClientWithoutFollowup: true,
      isExpirationApproaching: true,
    });
    expect(score).toBe(1.0);
  });

  it("scores review pending old correctly", () => {
    expect(scorePriorityItem({ isReviewPendingOld: true })).toBeCloseTo(0.25);
  });
});

describe("scoreToSeverity", () => {
  it("returns high for score >= 0.5", () => {
    expect(scoreToSeverity(0.5)).toBe("high");
    expect(scoreToSeverity(0.9)).toBe("high");
  });

  it("returns medium for 0.25-0.49", () => {
    expect(scoreToSeverity(0.25)).toBe("medium");
    expect(scoreToSeverity(0.49)).toBe("medium");
  });

  it("returns low for < 0.25", () => {
    expect(scoreToSeverity(0.1)).toBe("low");
    expect(scoreToSeverity(0)).toBe("low");
  });
});

describe("enrichUrgentItem", () => {
  const base: UrgentItem = {
    type: "review",
    entityId: "r1",
    score: 0.7,
    severity: "high",
    title: "Test review",
    description: "Pending",
  };

  it("copies base fields and adds extra", () => {
    const enriched = enrichUrgentItem(base, {
      blockedReasons: ["LOW_CONFIDENCE"],
      qualityGateStatus: "blocked_for_apply",
    });
    expect(enriched.blockedReasons).toEqual(["LOW_CONFIDENCE"]);
    expect(enriched.qualityGateStatus).toBe("blocked_for_apply");
    expect(enriched.title).toBe("Test review");
  });

  it("defaults entityType to item type", () => {
    const enriched = enrichUrgentItem(base);
    expect(enriched.entityType).toBe("review");
  });
});

describe("buildDeterministicSummary", () => {
  it("returns empty message for no items", () => {
    expect(buildDeterministicSummary([])).toBe("Žádné prioritní položky.");
  });

  it("builds summary from items", () => {
    const items: PriorityItem[] = [
      {
        type: "task",
        entityId: "t1",
        score: 0.9,
        severity: "high",
        title: "Urgentní úkol",
        description: "Po termínu",
        recommendedAction: "Dokončit úkol",
      },
      {
        type: "review",
        entityId: "r1",
        score: 0.5,
        severity: "medium",
        title: "Review",
        description: "Čeká",
        blockedReasons: ["LOW_CONFIDENCE"],
      },
    ];
    const summary = buildDeterministicSummary(items);
    expect(summary).toContain("1 urgentních");
    expect(summary).toContain("1 středně důležitých");
    expect(summary).toContain("1 blokovaných");
    expect(summary).toContain("Dokončit úkol");
  });
});
