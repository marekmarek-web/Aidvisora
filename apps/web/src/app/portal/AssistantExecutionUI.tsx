"use client";

/**
 * Phase 3H: Shared assistant execution UI components.
 * Used by both AiAssistantDrawer (desktop) and AiAssistantChatScreen (mobile)
 * to render confirmation previews, step outcomes, and next-step suggestions.
 */

import {
  CheckCircle2,
  XCircle,
  SkipForward,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ListChecks,
  User,
} from "lucide-react";
import {
  getExecutionStatusInfo,
  getStepOutcomeStatusLabel,
  hasAnyFailure,
  buildOutcomeSummaryLine,
  type StepOutcomeSummary,
  type StepPreviewItem,
  type ExecutionStatus,
} from "@/lib/ai/assistant-execution-ui";

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ─── EXECUTION BADGE ─────────────────────────────────────────────────────────

interface ExecutionBadgeProps {
  status: ExecutionStatus;
  totalSteps?: number;
  pendingSteps?: number;
  /** If true, renders inline (compact). Otherwise block-level card. */
  inline?: boolean;
}

export function ExecutionBadge({ status, totalSteps, pendingSteps, inline }: ExecutionBadgeProps) {
  const info = getExecutionStatusInfo(status);
  if (inline) {
    return (
      <div className={cx("inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold", info.badgeClassName)}>
        <span>{info.text}</span>
        {totalSteps ? <span>• {totalSteps} kroků</span> : null}
        {(pendingSteps ?? 0) > 0 ? <span>• čeká {pendingSteps}</span> : null}
      </div>
    );
  }
  return (
    <div className={cx("mt-2 rounded-xl border px-3 py-2", info.badgeClassName)}>
      <p className="text-xs font-bold">
        {info.text}
        {totalSteps ? ` • ${totalSteps} kroků` : ""}
        {(pendingSteps ?? 0) > 0 ? ` • čeká: ${pendingSteps}` : ""}
      </p>
    </div>
  );
}

// ─── CONTEXT LOCK BADGE ──────────────────────────────────────────────────────

interface ContextLockBadgeProps {
  lockedClientId: string | null;
  /** Display name — shown instead of truncated UUID if available. */
  lockedClientLabel?: string | null;
  className?: string;
}

export function ContextLockBadge({ lockedClientId, lockedClientLabel, className }: ContextLockBadgeProps) {
  if (!lockedClientId) return null;
  const label = lockedClientLabel?.trim() || `${lockedClientId.slice(0, 8)}…`;
  return (
    <div className={cx("inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-700", className)}>
      <User size={12} className="shrink-0" />
      <span>Kontext lock</span>
      <ChevronRight size={10} />
      <span>{label}</span>
    </div>
  );
}

// ─── CONFIRMATION PREVIEW PANEL ───────────────────────────────────────────────

interface ConfirmationPreviewPanelProps {
  stepPreviews: StepPreviewItem[];
  clientLabel?: string;
  /** Extra advisory / warning texts shown before the step list. */
  advisoryHints?: string[];
  /** If status is "draft", show different heading. */
  isDraft?: boolean;
}

export function ConfirmationPreviewPanel({
  stepPreviews,
  clientLabel,
  advisoryHints = [],
  isDraft = false,
}: ConfirmationPreviewPanelProps) {
  if (stepPreviews.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-100/60 border-b border-amber-200">
        <ListChecks size={14} className="text-amber-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">
            {isDraft ? "Chybějící informace" : "Co se provede"}
          </p>
          {clientLabel && (
            <p className="text-[10px] font-semibold text-amber-600 truncate">
              {clientLabel}
            </p>
          )}
        </div>
        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 rounded px-1.5 py-0.5">
          {stepPreviews.length} {stepPreviews.length === 1 ? "krok" : stepPreviews.length < 5 ? "kroky" : "kroků"}
        </span>
      </div>

      {/* Advisory hints (missing fields, domain warnings) */}
      {advisoryHints.length > 0 && (
        <div className="px-3 pt-2 space-y-1">
          {advisoryHints.map((hint, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700 font-medium">
              <AlertCircle size={11} className="shrink-0 mt-0.5" />
              <span>{hint}</span>
            </div>
          ))}
        </div>
      )}

      {/* Step list */}
      <div className="px-3 py-2 space-y-1.5">
        {stepPreviews.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[9px] font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-amber-900">{step.label}</span>
              {step.contextHint && (
                <span className="ml-1.5 text-[10px] font-semibold text-amber-600 bg-amber-100 rounded px-1 py-0.5">
                  {step.contextHint}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STEP OUTCOME CARD ───────────────────────────────────────────────────────

interface StepOutcomeCardProps {
  outcomes: StepOutcomeSummary[];
  hasPartialFailure?: boolean;
}

export function StepOutcomeCard({ outcomes, hasPartialFailure }: StepOutcomeCardProps) {
  if (outcomes.length === 0) return null;
  const failed = hasAnyFailure(outcomes, hasPartialFailure);
  const borderColor = failed ? "border-rose-200 bg-rose-50/60" : "border-emerald-200 bg-emerald-50/60";

  return (
    <div className={cx("mt-2 rounded-xl border overflow-hidden", borderColor)}>
      {/* Summary header */}
      <div className={cx(
        "px-3 py-2 border-b text-[10px] font-black uppercase tracking-wider",
        failed ? "border-rose-200 bg-rose-100/40 text-rose-700" : "border-emerald-200 bg-emerald-100/40 text-emerald-700",
      )}>
        {buildOutcomeSummaryLine(outcomes)}
      </div>

      {/* Per-step outcomes */}
      <div className="px-3 py-2 space-y-1.5">
        {outcomes.map((o, i) => {
          const icon =
            o.status === "succeeded" ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" /> :
            o.status === "failed"    ? <XCircle size={13} className="text-rose-600 shrink-0 mt-0.5" /> :
            o.status === "skipped"   ? <SkipForward size={13} className="text-slate-400 shrink-0 mt-0.5" /> :
                                       <RefreshCw size={13} className="text-indigo-400 shrink-0 mt-0.5" />;
          return (
            <div key={i} className="flex items-start gap-1.5">
              {icon}
              <div className="min-w-0 flex-1">
                <span className={cx(
                  "text-xs",
                  o.status === "failed" ? "text-rose-700 font-semibold" : "text-[color:var(--wp-text-secondary)]",
                )}>
                  {o.label}
                </span>
                {o.status !== "failed" && o.status !== "succeeded" && (
                  <span className="ml-1.5 text-[10px] text-[color:var(--wp-text-tertiary)]">
                    ({getStepOutcomeStatusLabel(o.status)})
                  </span>
                )}
                {o.error && <p className="text-rose-500 text-[10px] mt-0.5">{o.error}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SUGGESTED NEXT STEPS CHIPS ───────────────────────────────────────────────

interface SuggestedNextStepsChipsProps {
  steps: string[];
  onSend: (msg: string) => void;
}

export function SuggestedNextStepsChips({ steps, onSend }: SuggestedNextStepsChipsProps) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] font-black uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
        Doporučené kroky
      </p>
      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSend(s)}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-800 font-semibold hover:bg-indigo-100 active:bg-indigo-100 transition-colors text-left min-h-[32px]"
          >
            <Sparkles size={10} className="shrink-0 text-indigo-400" />
            {s.length > 50 ? s.slice(0, 48) + "…" : s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── WARNINGS BLOCK ───────────────────────────────────────────────────────────

interface WarningsBlockProps {
  warnings: string[];
}

export function WarningsBlock({ warnings }: WarningsBlockProps) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 font-medium">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}
