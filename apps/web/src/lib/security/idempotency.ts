type IdempotentResult<T> = {
  status: number;
  body: T;
};

type CacheEntry<T> = {
  expiresAt: number;
  promise?: Promise<IdempotentResult<T>>;
  result?: IdempotentResult<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const keyWindow = new Map<string, number>();

export async function executeIdempotent<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<IdempotentResult<T>>
): Promise<{ replayed: boolean; result: IdempotentResult<T> }> {
  const now = Date.now();
  const current = cache.get(key) as CacheEntry<T> | undefined;

  if (current && current.expiresAt > now) {
    if (current.result) {
      return { replayed: true, result: current.result };
    }
    if (current.promise) {
      const awaited = await current.promise;
      return { replayed: true, result: awaited };
    }
  }

  const entry: CacheEntry<T> = { expiresAt: now + ttlMs };
  entry.promise = factory()
    .then((result) => {
      entry.result = result;
      entry.promise = undefined;
      return result;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, entry as CacheEntry<unknown>);
  const result = await entry.promise;
  return { replayed: false, result };
}

export function tryBeginIdempotencyWindow(key: string, ttlMs: number): boolean {
  const now = Date.now();
  const expiresAt = keyWindow.get(key);
  if (expiresAt && expiresAt > now) return false;
  keyWindow.set(key, now + ttlMs);
  return true;
}
