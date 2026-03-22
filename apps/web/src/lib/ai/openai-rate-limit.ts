/**
 * Re-export from parent lib so imports from `lib/ai/*.ts` can use `./openai-rate-limit`.
 * (The implementation lives in `@/lib/openai-rate-limit`.)
 */
export {
  sleepMs,
  getOpenAIHttpStatus,
  isOpenAIRateLimitError,
  parseOpenAIRetryAfterSeconds,
  withOpenAIRateLimitRetry,
  type RateLimitRetryOptions,
} from "../openai-rate-limit";
