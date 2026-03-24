/**
 * Retry / fallback orchestration for pipeline steps.
 * Manages retry budget, strategy selection, and terminal state decisions.
 */

export type RetryStrategy =
  | "adobe_retry"
  | "text_only_fallback"
  | "classification_retry"
  | "extraction_retry"
  | "backoff_retry"
  | "manual_escalation";

export type RetryDecision = {
  shouldRetry: boolean;
  strategy: RetryStrategy;
  reason: string;
  retryCount: number;
  maxRetries: number;
};

export type FailedStepInfo = {
  failedStep: string;
  errorCode?: string;
  currentRetryCount: number;
};

const MAX_RETRIES_BY_STEP: Record<string, number> = {
  adobe_preprocess: 2,
  detect_input_mode: 1,
  classify_document: 1,
  structured_extraction: 2,
  payment_extraction: 1,
};

const DEFAULT_MAX_RETRIES = 1;

const STEP_STRATEGIES: Record<string, RetryStrategy> = {
  adobe_preprocess: "adobe_retry",
  detect_input_mode: "text_only_fallback",
  classify_document: "classification_retry",
  structured_extraction: "extraction_retry",
  payment_extraction: "extraction_retry",
};

/**
 * Decide whether to retry a failed pipeline step and which strategy to use.
 */
export function evaluateRetryDecision(info: FailedStepInfo): RetryDecision {
  const maxRetries = MAX_RETRIES_BY_STEP[info.failedStep] ?? DEFAULT_MAX_RETRIES;

  if (info.errorCode === "OPENAI_RATE_LIMIT") {
    return {
      shouldRetry: info.currentRetryCount < 3,
      strategy: "backoff_retry",
      reason: "Rate limit — exponential backoff recommended.",
      retryCount: info.currentRetryCount,
      maxRetries: 3,
    };
  }

  if (info.currentRetryCount >= maxRetries) {
    return {
      shouldRetry: false,
      strategy: "manual_escalation",
      reason: `Retry budget exhausted for ${info.failedStep} (${info.currentRetryCount}/${maxRetries}).`,
      retryCount: info.currentRetryCount,
      maxRetries,
    };
  }

  const strategy = STEP_STRATEGIES[info.failedStep] ?? "manual_escalation";

  return {
    shouldRetry: true,
    strategy,
    reason: `Step ${info.failedStep} failed — retry with ${strategy}.`,
    retryCount: info.currentRetryCount,
    maxRetries,
  };
}

/**
 * Get a fallback strategy when the primary strategy fails.
 * Returns null if no further fallback is available.
 */
export function getFallbackStrategy(
  failedStep: string,
  currentStrategy: RetryStrategy,
): RetryStrategy | null {
  const fallbacks: Record<string, Record<string, RetryStrategy>> = {
    adobe_preprocess: { adobe_retry: "text_only_fallback" },
    structured_extraction: { extraction_retry: "manual_escalation" },
    payment_extraction: { extraction_retry: "manual_escalation" },
  };

  return fallbacks[failedStep]?.[currentStrategy] ?? null;
}

/**
 * Determine if a failed step represents a terminal (non-retryable) state.
 */
export function isTerminalFailure(info: FailedStepInfo): boolean {
  const decision = evaluateRetryDecision(info);
  if (decision.shouldRetry) return false;
  const primaryStrategy = STEP_STRATEGIES[info.failedStep] ?? "manual_escalation";
  const fallback = getFallbackStrategy(info.failedStep, primaryStrategy);
  return fallback === null;
}
