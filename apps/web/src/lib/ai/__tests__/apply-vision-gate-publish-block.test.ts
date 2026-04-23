import { describe, it, expect } from "vitest";

import { evaluateVisionGatePublishBlock } from "../apply-vision-gate-publish-block";

describe("evaluateVisionGatePublishBlock", () => {
  it("returns no-op when extractionTrace is null/undefined", () => {
    expect(evaluateVisionGatePublishBlock({ enforced: true })).toEqual({
      signal: null,
      blocked: false,
      error: "",
    });
    expect(
      evaluateVisionGatePublishBlock({ extractionTrace: null, enforced: true })
    ).toEqual({ signal: null, blocked: false, error: "" });
  });

  it("returns no-op when gate decision has no critical/block reasons", () => {
    const res = evaluateVisionGatePublishBlock({
      extractionTrace: {
        visionFallbackGate: {
          hardBlockPublish: false,
          publishBlockReasons: [],
          criticalFieldsFromVision: [],
        },
      },
      enforced: true,
    });
    expect(res).toEqual({ signal: null, blocked: false, error: "" });
  });

  it("permissive (enforced=false): emits signal but does NOT block on critical-from-image", () => {
    const res = evaluateVisionGatePublishBlock({
      extractionTrace: {
        visionFallbackGate: {
          hardBlockPublish: false,
          publishBlockReasons: ["critical_field_recovered_from_image"],
          criticalFieldsFromVision: ["iban"],
        },
      },
      enforced: false,
    });
    expect(res.signal).toContain("criticalFields=[iban]");
    expect(res.signal).toContain("enforced=false");
    expect(res.blocked).toBe(false);
    expect(res.error).toBe("");
  });

  it("enforced=true AND critical-from-image → blocked with advisor-facing error mentioning the field", () => {
    const res = evaluateVisionGatePublishBlock({
      extractionTrace: {
        visionFallbackGate: {
          hardBlockPublish: true,
          publishBlockReasons: ["critical_field_recovered_from_image"],
          criticalFieldsFromVision: ["personalId", "policyAmount"],
        },
      },
      enforced: true,
    });
    expect(res.blocked).toBe(true);
    expect(res.error).toContain("personalId");
    expect(res.signal).toContain("enforced=true");
  });

  it("enforced=true but only hardBlockPublish without critical list → still blocks with fallback label", () => {
    const res = evaluateVisionGatePublishBlock({
      extractionTrace: {
        visionFallbackGate: {
          hardBlockPublish: true,
          publishBlockReasons: ["recovered_ratio_above_threshold"],
          criticalFieldsFromVision: [],
        },
      },
      enforced: true,
    });
    expect(res.blocked).toBe(true);
    expect(res.error).toContain("kritické pole");
  });

  it("clean digital PDF (no gate decision serialized) → no signal, no block even when enforced", () => {
    const res = evaluateVisionGatePublishBlock({
      extractionTrace: { something: "else" },
      enforced: true,
    });
    expect(res).toEqual({ signal: null, blocked: false, error: "" });
  });
});
