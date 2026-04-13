"use client";

import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { TeamOverviewPageModel } from "@/lib/team-overview-page-model";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";
import { formatCareerProgramLabel, formatCareerTrackLabel } from "@/lib/career/evaluate-career-progress";
import {
  completenessToPercent,
  readinessPercentFromRequirements,
} from "@/lib/team-overview-structure-classification";

const STATUS_ROWS = [
  "Na dobré cestě",
  "Potřebuje pozornost",
  "Vyžaduje doplnění",
  "Částečně vyhodnoceno",
  "Bez dostatku dat",
] as const;

const STATUS_STYLES: Record<string, string> = {
  "Na dobré cestě": "text-emerald-700",
  "Potřebuje pozornost": "text-amber-700 font-semibold",
  "Vyžaduje doplnění": "text-violet-700",
  "Částečně vyhodnoceno": "text-blue-700",
  "Bez dostatku dat": "text-[color:var(--wp-text-tertiary)]",
};

/** Součty pro horní tři karty — vzájemně disjunktní kubky podle progressEvaluation / completeness. */
export function computeCareerStatBuckets(metrics: TeamMemberMetrics[]) {
  let readyToAdvance = 0;
  let pendingReview = 0;
  let blocked = 0;
  for (const m of metrics) {
    const pe = m.careerEvaluation.progressEvaluation;
    const ec = m.careerEvaluation.evaluationCompleteness;
    if (pe === "blocked") {
      blocked += 1;
    } else if (pe === "promoted_ready" || pe === "close_to_promotion") {
      readyToAdvance += 1;
    } else if (ec === "manual_required") {
      pendingReview += 1;
    }
  }
  return { readyToAdvance, pendingReview, blocked };
}

export function TeamOverviewCareerSummarySection({
  members,
  metrics,
  pageModel,
  displayName,
  selectMember,
  onOpenCrm,
  onOpenProgress,
}: {
  members: TeamMemberInfo[];
  metrics: TeamMemberMetrics[];
  pageModel: TeamOverviewPageModel;
  displayName: (m: TeamMemberInfo) => string;
  selectMember: (userId: string) => void;
  onOpenCrm: (userId: string) => void;
  onOpenProgress: (userId: string) => void;
}) {
  if (members.length === 0) return null;

  const hasTracks = pageModel.careerTeamSummary.byTrack.length > 0;
  const metricsByUser = new Map(metrics.map((x) => [x.userId, x]));
  const statBuckets = computeCareerStatBuckets(metrics);

  return (
    <section
      className="mb-8 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm"
      aria-labelledby="team-career-growth-heading"
    >
      <div className="grid gap-3 border-b border-slate-200/80 bg-slate-50/40 px-5 py-4 sm:px-6 sm:grid-cols-3">
        <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800/80">Připraveno k posunu</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-emerald-900">{statBuckets.readyToAdvance}</p>
        </div>
        <div className="rounded-3xl border border-amber-200/80 bg-amber-50/40 px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-900/80">Ke schválení</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-amber-950">{statBuckets.pendingReview}</p>
        </div>
        <div className="rounded-3xl border border-rose-200/80 bg-rose-50/40 px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-900/80">Blokováno</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-rose-950">{statBuckets.blocked}</p>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-slate-200/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-5 py-3 sm:px-6">Poradce</th>
              <th className="px-3 py-3">Aktuální krok</th>
              <th className="px-3 py-3">Další krok</th>
              <th className="px-3 py-3">Readiness %</th>
              <th className="px-3 py-3">Blokátory / status</th>
              <th className="px-5 py-3 text-right sm:px-6">Akce</th>
            </tr>
          </thead>
          <tbody>
            {members.map((mem) => {
              const mm = metricsByUser.get(mem.userId);
              if (!mm) return null;
              const ce = mm.careerEvaluation;
              const readiness = Math.max(
                completenessToPercent(ce.evaluationCompleteness),
                readinessPercentFromRequirements(ce.missingRequirements)
              );
              const blocker =
                ce.missingRequirements[0]?.labelCs ?? ce.managerProgressLabel ?? "—";
              return (
                <tr
                  key={mem.userId}
                  className="cursor-pointer border-t border-slate-200/70 transition hover:bg-slate-50/70"
                  onClick={() => selectMember(mem.userId)}
                >
                  <td className="px-5 py-3 font-semibold text-[color:var(--wp-text)] sm:px-6">{displayName(mem)}</td>
                  <td className="px-3 py-3 text-xs text-[color:var(--wp-text-secondary)]">
                    {ce.careerPositionLabel ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-[color:var(--wp-text-secondary)]">
                    {ce.nextCareerPositionLabel ?? "—"}
                  </td>
                  <td className="px-3 py-3 font-bold tabular-nums text-slate-950">{readiness} %</td>
                  <td className="max-w-[200px] px-3 py-3 text-xs text-[color:var(--wp-text-secondary)] line-clamp-2">
                    {blocker}
                  </td>
                  <td className="px-5 py-3 text-right sm:px-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProgress(mem.userId);
                        selectMember(mem.userId);
                      }}
                      className="rounded-2xl bg-violet-100 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-900 transition hover:bg-violet-200/80"
                    >
                      Strom progresu
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCrm(mem.userId);
                        selectMember(mem.userId);
                      }}
                      className="ml-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-800 transition hover:bg-slate-50"
                    >
                      CRM karta
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/50 px-5 py-3.5 sm:px-6">
        <h2
          id="team-career-growth-heading"
          className="flex items-center gap-2 text-lg font-black tracking-tight text-[color:var(--wp-text)]"
        >
          <Briefcase className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          Kariérní přehled
        </h2>
        <Link
          href="/portal/team-overview#sprava-tymu"
          className="text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline"
        >
          Doplnit data
        </Link>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-12">
        {/* Větve */}
        <div className="lg:col-span-4 space-y-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
            Podle větve
          </p>
          {!hasTracks ? (
            <p className="text-xs text-[color:var(--wp-text-secondary)] leading-relaxed">
              Bez rozlišených větví — doplněním zpřesníte doporučení.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {pageModel.careerTeamSummary.byTrack.map((t) => (
                <li key={t.trackId} className="flex items-center justify-between gap-2">
                  <span className="text-[color:var(--wp-text-secondary)] truncate text-xs">{t.label}</span>
                  <span className="shrink-0 rounded-full bg-violet-100/80 px-2 py-0.5 text-[11px] font-bold tabular-nums text-violet-900">
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Doplňkové stavy */}
          <div className="mt-1 space-y-1.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-3 text-xs">
            <p className="flex items-center justify-between gap-2">
              <span className="text-[color:var(--wp-text-secondary)]">Chybí data / doplnění</span>
              <span className="font-semibold tabular-nums text-[color:var(--wp-text)]">
                {pageModel.careerTeamSummary.needsAttentionDataCount}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-[color:var(--wp-text-secondary)]">Ruční ověření</span>
              <span className="font-semibold tabular-nums text-[color:var(--wp-text)]">
                {pageModel.careerTeamSummary.manualOrPartialCount}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-[color:var(--wp-text-secondary)]">V adaptaci</span>
              <span className="font-semibold tabular-nums text-[color:var(--wp-text)]">
                {pageModel.careerTeamSummary.startersInAdaptationCount}
              </span>
            </p>
          </div>
        </div>

        {/* Stav evaluace */}
        <div className="lg:col-span-4 space-y-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
            Stav evaluace
          </p>
          <ul className="space-y-1.5">
            {STATUS_ROWS.map((label) => {
              const c = pageModel.careerTeamSummary.byManagerLabel[label] ?? 0;
              if (c === 0) return null;
              return (
                <li key={label} className="flex items-center justify-between gap-2 text-xs">
                  <span className={STATUS_STYLES[label] ?? "text-[color:var(--wp-text-secondary)]"}>
                    {label}
                  </span>
                  <span className="font-semibold tabular-nums text-[color:var(--wp-text)]">{c}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Doporučená 1:1 */}
        <div className="lg:col-span-4 space-y-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
            Doporučená 1:1 (kariéra)
          </p>
          {pageModel.careerTeamSummary.topAttention.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3 py-3">
              <p className="font-semibold text-sm text-[color:var(--wp-text)]">Na dobré cestě</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--wp-text-secondary)]">
                Z kariérního pohledu nikdo nezasahuje — udržujte pravidelný kontakt.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {pageModel.careerTeamSummary.topAttention.map((x) => {
                const mem = members.find((m) => m.userId === x.userId);
                const name = mem ? displayName(mem) : x.displayName || x.email || "Člen týmu";
                return (
                  <li key={x.userId}>
                    <button
                      type="button"
                      onClick={() => selectMember(x.userId)}
                      className="group block w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-left transition hover:border-violet-200 hover:bg-violet-50/60"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-[color:var(--wp-text)]">{name}</p>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 text-violet-400 opacity-0 transition group-hover:opacity-100" aria-hidden />
                      </div>
                      <p className="mt-0.5 text-[11px] font-bold text-violet-800/90">{x.managerProgressLabel}</p>
                      <p className="mt-0.5 text-[11px] text-[color:var(--wp-text-secondary)] line-clamp-1">{x.reason}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {!hasTracks && members.length > 0 ? (
        <div className="mx-5 mb-5 rounded-2xl border border-amber-200/60 bg-amber-50/40 px-4 py-2.5 sm:mx-6 sm:mb-6">
          <p className="text-xs text-amber-950/90">
            <span className="font-semibold">Příležitost:</span> bez vyplněných kariérních větví zůstávají souhrny obecnější. Údaje doplníte v{" "}
            <Link href="/portal/team-overview#sprava-tymu" className="underline hover:text-amber-800">
              Týmový přehled → Správa týmu
            </Link>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}
