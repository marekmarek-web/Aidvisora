/**
 * P6: lightweight in-process counters for assistant lifecycle (audit_log remains source of truth).
 * Safe to call from telemetry; no PII stored.
 */

const metrics = new Map<string, number>();

export function bumpAssistantMetric(key: string, by = 1): void {
  if (!key || by === 0) return;
  metrics.set(key, (metrics.get(key) ?? 0) + by);
}

/** Snapshot for health checks / optional admin endpoint. */
export function getAssistantMetricsSnapshot(): Record<string, number> {
  return Object.fromEntries(metrics);
}

/** Vitest only. */
export function resetAssistantMetricsForTests(): void {
  metrics.clear();
}

/**
 * P6: simple threshold helpers (caller decides whether to alert).
 */
export function assistantMetricExceeds(key: string, threshold: number): boolean {
  return (metrics.get(key) ?? 0) > threshold;
}
