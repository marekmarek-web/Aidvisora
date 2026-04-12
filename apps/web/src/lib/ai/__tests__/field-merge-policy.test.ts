import { describe, it, expect } from "vitest";
import {
  resolveFieldMerge,
  resolveFieldMergeBatch,
  batchHasConflicts,
} from "../field-merge-policy";

describe("resolveFieldMerge", () => {
  it("auto-fills when existing is empty and incoming has value", () => {
    const d = resolveFieldMerge(null, "Jan Novák");
    expect(d.action).toBe("apply_incoming");
    expect(d.reason).toBe("auto_fill");
    expect(d.resolvedValue).toBe("Jan Novák");
    expect(d.requiresAdvisorReview).toBe(false);
  });

  it("keeps existing when incoming is empty", () => {
    const d = resolveFieldMerge("Jan Novák", null);
    expect(d.action).toBe("keep_existing");
    expect(d.reason).toBe("incoming_empty");
    expect(d.resolvedValue).toBe("Jan Novák");
  });

  it("is a no-op when both values are identical (normalised)", () => {
    const d = resolveFieldMerge("Jan Novák", "  Jan Novák  ");
    expect(d.action).toBe("keep_existing");
    expect(d.reason).toBe("identity");
    expect(d.requiresAdvisorReview).toBe(false);
  });

  it("flags pending when manual existing differs from incoming", () => {
    const d = resolveFieldMerge("Jan Novák", "Jana Nováková", "manual");
    expect(d.action).toBe("flag_pending");
    expect(d.reason).toBe("manual_protected");
    expect(d.resolvedValue).toBe("Jana Nováková");
    expect(d.requiresAdvisorReview).toBe(true);
  });

  it("flags pending conflict when ai_review existing differs from incoming", () => {
    const d = resolveFieldMerge("Jan Novák", "Jana Nováková", "ai_review");
    expect(d.action).toBe("flag_pending");
    expect(d.reason).toBe("conflict");
    expect(d.requiresAdvisorReview).toBe(true);
  });

  it("defaults to manual protection when sourceKind not provided", () => {
    const d = resolveFieldMerge("Existující hodnota", "Nová hodnota");
    expect(d.action).toBe("flag_pending");
    expect(d.reason).toBe("manual_protected");
  });

  it("treats dash as empty", () => {
    const d = resolveFieldMerge("—", "Jan Novák");
    expect(d.action).toBe("apply_incoming");
    expect(d.reason).toBe("auto_fill");
  });

  it("treats empty string as empty", () => {
    const d = resolveFieldMerge("", "Jan Novák", "ai_review");
    expect(d.action).toBe("apply_incoming");
    expect(d.reason).toBe("auto_fill");
  });

  it("auto-fills from document source when existing is empty", () => {
    const d = resolveFieldMerge(undefined, "Česká pojišťovna", "document");
    expect(d.action).toBe("apply_incoming");
    expect(d.reason).toBe("auto_fill");
  });
});

describe("resolveFieldMergeBatch", () => {
  it("processes multiple fields and returns decisions for each", () => {
    const results = resolveFieldMergeBatch([
      { fieldKey: "firstName", existing: null, incoming: "Jana" },
      { fieldKey: "lastName", existing: "Nováková", incoming: "Nováková" },
      { fieldKey: "phone", existing: "+420123456789", incoming: "+420987654321", existingSourceKind: "manual" },
    ]);
    expect(results[0].decision.action).toBe("apply_incoming");
    expect(results[1].decision.action).toBe("keep_existing");
    expect(results[2].decision.action).toBe("flag_pending");
  });
});

describe("batchHasConflicts", () => {
  it("returns true when any field needs advisor review", () => {
    const results = resolveFieldMergeBatch([
      { fieldKey: "a", existing: null, incoming: "value" },
      { fieldKey: "b", existing: "old", incoming: "new", existingSourceKind: "manual" },
    ]);
    expect(batchHasConflicts(results)).toBe(true);
  });

  it("returns false when no conflicts", () => {
    const results = resolveFieldMergeBatch([
      { fieldKey: "a", existing: null, incoming: "value" },
      { fieldKey: "b", existing: "same", incoming: "same" },
    ]);
    expect(batchHasConflicts(results)).toBe(false);
  });
});
