import { describe, expect, it } from "vitest";
import {
  getReasonCode,
  getReasonMessage,
  isBlocking,
  isRetryRecommended,
  getAllReasonCodes,
} from "../reason-codes";

describe("reason-codes", () => {
  it("returns a known code", () => {
    const code = getReasonCode("preprocess_failed");
    expect(code).toBeDefined();
    expect(code!.severity).toBe("warning");
    expect(code!.retryRecommended).toBe(true);
    expect(code!.retryStrategy).toBe("adobe_retry");
  });

  it("returns undefined for unknown code", () => {
    expect(getReasonCode("nonexistent")).toBeUndefined();
  });

  it("getReasonMessage returns human message", () => {
    expect(getReasonMessage("rate_limit_exceeded")).toContain("přetížená");
  });

  it("getReasonMessage returns code itself for unknown", () => {
    expect(getReasonMessage("xyz")).toBe("xyz");
  });

  it("isBlocking checks severity", () => {
    expect(isBlocking("payment_missing_critical_fields")).toBe(true);
    expect(isBlocking("low_text_coverage")).toBe(false);
  });

  it("isRetryRecommended checks flag", () => {
    expect(isRetryRecommended("preprocess_timeout")).toBe(true);
    expect(isRetryRecommended("proposal_not_final")).toBe(false);
  });

  it("getAllReasonCodes returns all entries", () => {
    const all = getAllReasonCodes();
    expect(all.length).toBeGreaterThan(15);
    expect(all.every((c) => c.code && c.humanMessage)).toBe(true);
  });

  it("no duplicate codes", () => {
    const all = getAllReasonCodes();
    const codes = all.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
