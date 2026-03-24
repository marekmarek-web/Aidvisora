import { describe, expect, it } from "vitest";
import {
  evaluateRetryDecision,
  getFallbackStrategy,
  isTerminalFailure,
} from "../retry-orchestrator";

describe("evaluateRetryDecision", () => {
  it("allows retry for adobe_preprocess on first failure", () => {
    const result = evaluateRetryDecision({
      failedStep: "adobe_preprocess",
      currentRetryCount: 0,
    });
    expect(result.shouldRetry).toBe(true);
    expect(result.strategy).toBe("adobe_retry");
    expect(result.maxRetries).toBe(2);
  });

  it("exhausts budget after max retries", () => {
    const result = evaluateRetryDecision({
      failedStep: "adobe_preprocess",
      currentRetryCount: 2,
    });
    expect(result.shouldRetry).toBe(false);
    expect(result.strategy).toBe("manual_escalation");
  });

  it("uses backoff for rate limit errors", () => {
    const result = evaluateRetryDecision({
      failedStep: "structured_extraction",
      errorCode: "OPENAI_RATE_LIMIT",
      currentRetryCount: 1,
    });
    expect(result.shouldRetry).toBe(true);
    expect(result.strategy).toBe("backoff_retry");
    expect(result.maxRetries).toBe(3);
  });

  it("stops rate limit retries after 3", () => {
    const result = evaluateRetryDecision({
      failedStep: "structured_extraction",
      errorCode: "OPENAI_RATE_LIMIT",
      currentRetryCount: 3,
    });
    expect(result.shouldRetry).toBe(false);
  });

  it("handles unknown step with default max retries", () => {
    const result = evaluateRetryDecision({
      failedStep: "unknown_step",
      currentRetryCount: 0,
    });
    expect(result.shouldRetry).toBe(true);
    expect(result.maxRetries).toBe(1);
  });
});

describe("getFallbackStrategy", () => {
  it("provides text_only_fallback for adobe_retry failure", () => {
    expect(getFallbackStrategy("adobe_preprocess", "adobe_retry")).toBe("text_only_fallback");
  });

  it("provides manual_escalation for extraction_retry failure", () => {
    expect(getFallbackStrategy("structured_extraction", "extraction_retry")).toBe("manual_escalation");
  });

  it("returns null when no further fallback", () => {
    expect(getFallbackStrategy("classify_document", "classification_retry")).toBeNull();
  });
});

describe("isTerminalFailure", () => {
  it("is not terminal when retries remain", () => {
    expect(isTerminalFailure({ failedStep: "adobe_preprocess", currentRetryCount: 0 })).toBe(false);
  });

  it("is not terminal when fallback exists", () => {
    expect(isTerminalFailure({ failedStep: "adobe_preprocess", currentRetryCount: 2 })).toBe(false);
  });

  it("is terminal when budget exhausted and no fallback", () => {
    expect(isTerminalFailure({ failedStep: "classify_document", currentRetryCount: 1 })).toBe(true);
  });
});
