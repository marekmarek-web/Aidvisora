/**
 * Phase 3H: shared UX helpers for assistant execution state.
 * Used by both desktop drawer and mobile chat screen.
 */

export type ExecutionStatus =
  | "draft"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "partial_failure";

export type StepOutcomeStatus = "succeeded" | "failed" | "skipped" | "idempotent_hit";

export type ExecutionStatusInfo = {
  text: string;
  tone: "amber" | "emerald" | "rose" | "indigo" | "slate";
  /** Full Tailwind class string for badge background+border+text. */
  badgeClassName: string;
};

const STATUS_MAP: Record<ExecutionStatus, ExecutionStatusInfo> = {
  awaiting_confirmation: {
    text: "Čeká na potvrzení",
    tone: "amber",
    badgeClassName: "text-amber-700 bg-amber-50 border-amber-200",
  },
  executing: {
    text: "Provádím kroky",
    tone: "indigo",
    badgeClassName: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  partial_failure: {
    text: "Částečně selhalo",
    tone: "rose",
    badgeClassName: "text-rose-700 bg-rose-50 border-rose-200",
  },
  completed: {
    text: "Provedeno",
    tone: "emerald",
    badgeClassName: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  draft: {
    text: "Návrh akcí",
    tone: "slate",
    badgeClassName: "text-slate-700 bg-slate-50 border-slate-200",
  },
};

export function getExecutionStatusInfo(status: ExecutionStatus): ExecutionStatusInfo {
  return STATUS_MAP[status] ?? STATUS_MAP.draft;
}

export type StepOutcomeSummary = {
  label: string;
  status: StepOutcomeStatus;
  entityId?: string | null;
  error?: string | null;
};

export type StepPreviewItem = {
  label: string;
  action: string;
  contextHint?: string;
};

/** Returns a short, readable label for a step outcome status. */
export function getStepOutcomeStatusLabel(status: StepOutcomeStatus): string {
  switch (status) {
    case "succeeded": return "Provedeno";
    case "failed": return "Selhalo";
    case "skipped": return "Přeskočeno";
    case "idempotent_hit": return "Již existuje";
  }
}

/** Returns whether a given outcome collection has any failure. */
export function hasAnyFailure(
  outcomes: StepOutcomeSummary[],
  hasPartialFailure?: boolean,
): boolean {
  return (hasPartialFailure ?? false) || outcomes.some(o => o.status === "failed");
}

/** Returns the summary line for a step outcome card header. */
export function buildOutcomeSummaryLine(outcomes: StepOutcomeSummary[]): string {
  const failedCount = outcomes.filter(o => o.status === "failed").length;
  const succeededCount = outcomes.filter(o => o.status === "succeeded").length;
  if (failedCount > 0) return `${failedCount} z ${outcomes.length} kroků selhalo`;
  return `${succeededCount} / ${outcomes.length} kroků dokončeno`;
}
