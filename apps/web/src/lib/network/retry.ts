type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
};

type RetryFetchWithTimeoutOptions = RetryOptions & {
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(delayMs: number, jitterRatio: number) {
  const jitter = delayMs * jitterRatio;
  const min = Math.max(0, delayMs - jitter);
  const max = delayMs + jitter;
  return Math.floor(min + Math.random() * (max - min));
}

function isRecoverableStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

export async function retryFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 2_000;
  const jitterRatio = options.jitterRatio ?? 0.25;

  let attempt = 0;
  let delayMs = initialDelayMs;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(input, init);
      if (!isRecoverableStatus(response.status) || attempt >= maxAttempts) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        throw error;
      }
    }

    await sleep(withJitter(delayMs, jitterRatio));
    delayMs = Math.min(maxDelayMs, delayMs * 2);
  }

  throw lastError instanceof Error ? lastError : new Error("retryFetch failed");
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function retryFetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  options: RetryFetchWithTimeoutOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retryOptions: RetryOptions = {
    maxAttempts: options.maxAttempts,
    initialDelayMs: options.initialDelayMs,
    maxDelayMs: options.maxDelayMs,
    jitterRatio: options.jitterRatio,
  };

  const maxAttempts = retryOptions.maxAttempts ?? 3;
  const initialDelayMs = retryOptions.initialDelayMs ?? 250;
  const maxDelayMs = retryOptions.maxDelayMs ?? 2_000;
  const jitterRatio = retryOptions.jitterRatio ?? 0.25;

  let attempt = 0;
  let delayMs = initialDelayMs;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs);
      if (!isRecoverableStatus(response.status) || attempt >= maxAttempts) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        throw error;
      }
    }
    await sleep(withJitter(delayMs, jitterRatio));
    delayMs = Math.min(maxDelayMs, delayMs * 2);
  }

  throw lastError instanceof Error ? lastError : new Error("retryFetchWithTimeout failed");
}
