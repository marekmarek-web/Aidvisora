import { describe, it, expect } from "vitest";
import { compareExtractedToCorrected } from "../eval-comparison";

describe("eval-comparison", () => {
  it("returns empty when extracted and corrected are equal", () => {
    const extracted = { contractNumber: "1", institutionName: "A" };
    const result = compareExtractedToCorrected(extracted, { ...extracted });
    expect(result.changedFields).toHaveLength(0);
    expect(Object.keys(result.delta)).toHaveLength(0);
  });

  it("detects changed field", () => {
    const extracted = { contractNumber: "1", institutionName: "A" };
    const corrected = { contractNumber: "2", institutionName: "A" };
    const result = compareExtractedToCorrected(extracted, corrected);
    expect(result.changedFields).toContain("contractNumber");
    expect(result.delta.contractNumber).toEqual({ from: "1", to: "2" });
  });

  it("detects added in correction", () => {
    const extracted = { contractNumber: "1" };
    const corrected = { contractNumber: "1", institutionName: "Banka" };
    const result = compareExtractedToCorrected(extracted, corrected);
    expect(result.addedInCorrection).toContain("institutionName");
    expect(result.changedFields).toContain("institutionName");
  });

  it("detects removed in correction", () => {
    const extracted = { contractNumber: "1", institutionName: "A" };
    const corrected = { contractNumber: "1" };
    const result = compareExtractedToCorrected(extracted, corrected);
    expect(result.removedInCorrection).toContain("institutionName");
  });

  it("compares nested client object", () => {
    const extracted = { client: { email: "old@x.cz" } };
    const corrected = { client: { email: "new@x.cz" } };
    const result = compareExtractedToCorrected(extracted, corrected);
    expect(result.changedFields).toContain("client.email");
    expect(result.delta["client.email"]).toEqual({ from: "old@x.cz", to: "new@x.cz" });
  });
});
