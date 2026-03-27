/** Logs wall time when AIDVISORA_PERF_LOG=1 or NODE_ENV=development. */
export function perfLog(label: string, startedAt: number): void {
  if (process.env.AIDVISORA_PERF_LOG !== "1" && process.env.NODE_ENV !== "development") return;
  console.log(`[perf] ${label} ${Date.now() - startedAt}ms`);
}

/** Delta from an anchor timestamp (e.g. gate start vs. KPIs ready). */
export function perfLogSince(label: string, anchorMs: number): void {
  if (process.env.AIDVISORA_PERF_LOG !== "1" && process.env.NODE_ENV !== "development") return;
  console.log(`[perf] ${label} +${Date.now() - anchorMs}ms`);
}
