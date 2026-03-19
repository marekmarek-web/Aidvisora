type Entry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

const buckets = new Map<string, Entry>();

function now() {
  return Date.now();
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(
  request: Request,
  routeKey: string,
  subjectKey: string | null | undefined,
  options: RateLimitOptions
) {
  const identity = (subjectKey && subjectKey.trim()) || getClientIp(request);
  const key = `${routeKey}:${identity}`;
  const currentNow = now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= currentNow) {
    buckets.set(key, { count: 1, resetAt: currentNow + options.windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (current.count >= options.maxRequests) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - currentNow) / 1000)),
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return { ok: true, retryAfterSec: 0 };
}
