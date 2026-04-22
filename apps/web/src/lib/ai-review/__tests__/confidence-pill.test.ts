/**
 * confidence-pill — unit tests.
 *
 * Covers the pure label / level resolver used by the AI Review left panel's
 * confidence pill. Rendering is handled by a tiny React wrapper in
 * ExtractionLeftPanel.tsx; all logic lives here and is verified below.
 */

import { describe, it, expect } from "vitest";
import { resolveConfidencePill } from "../confidence-pill";

describe("resolveConfidencePill", () => {
  it("CP01: hasValue=false → pill hidden regardless of confidence", () => {
    const res = resolveConfidencePill(95, false);
    expect(res.label).toBeNull();
    expect(res.level).toBeNull();
    expect(res.clamped).toBeNull();
  });

  it("CP02: non-finite confidence → pill hidden", () => {
    expect(resolveConfidencePill(Number.NaN, true).label).toBeNull();
    expect(resolveConfidencePill(Number.POSITIVE_INFINITY, true).label).toBeNull();
  });

  it("CP03: confidence 95 → Vysoká / vysoka", () => {
    const res = resolveConfidencePill(95, true);
    expect(res.label).toBe("Vysoká");
    expect(res.level).toBe("vysoka");
    expect(res.clamped).toBe(95);
  });

  it("CP04: confidence exactly 85 → Vysoká (boundary inclusive)", () => {
    expect(resolveConfidencePill(85, true).label).toBe("Vysoká");
  });

  it("CP05: confidence 70 → Střední / stredni", () => {
    const res = resolveConfidencePill(70, true);
    expect(res.label).toBe("Střední");
    expect(res.level).toBe("stredni");
    expect(res.clamped).toBe(70);
  });

  it("CP06: confidence exactly 50 → Střední (boundary inclusive)", () => {
    expect(resolveConfidencePill(50, true).label).toBe("Střední");
  });

  it("CP07: confidence 49 → Nízká / nizka", () => {
    const res = resolveConfidencePill(49, true);
    expect(res.label).toBe("Nízká");
    expect(res.level).toBe("nizka");
    expect(res.clamped).toBe(49);
  });

  it("CP08: confidence 0 → Nízká", () => {
    const res = resolveConfidencePill(0, true);
    expect(res.label).toBe("Nízká");
    expect(res.clamped).toBe(0);
  });

  it("CP09: clamps > 100 to 100", () => {
    const res = resolveConfidencePill(250, true);
    expect(res.clamped).toBe(100);
    expect(res.label).toBe("Vysoká");
  });

  it("CP10: clamps < 0 to 0", () => {
    const res = resolveConfidencePill(-40, true);
    expect(res.clamped).toBe(0);
    expect(res.label).toBe("Nízká");
  });

  it("CP11: fractional confidence is rounded for display", () => {
    expect(resolveConfidencePill(84.6, true).clamped).toBe(85);
    expect(resolveConfidencePill(84.4, true).clamped).toBe(84);
  });
});
