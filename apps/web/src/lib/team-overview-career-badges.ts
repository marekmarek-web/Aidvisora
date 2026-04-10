import type { EvaluationCompleteness, ProgressEvaluation } from "@/lib/career/types";

export function overviewCareerProgressBadgeClass(pe: ProgressEvaluation): string {
  if (pe === "on_track" || pe === "close_to_promotion" || pe === "promoted_ready") {
    return "bg-emerald-50 text-emerald-800 border border-emerald-200/70";
  }
  return "bg-amber-50 text-amber-900 border border-amber-200/70";
}

export function overviewCareerCompletenessBadgeClass(ec: EvaluationCompleteness): string {
  if (ec === "full") return "bg-slate-50 text-slate-700 border border-slate-200/80";
  return "bg-violet-50 text-violet-800 border border-violet-200/70";
}
