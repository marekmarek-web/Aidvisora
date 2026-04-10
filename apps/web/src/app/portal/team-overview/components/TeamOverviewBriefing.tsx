"use client";

import clsx from "clsx";
import type { TeamOverviewKpis } from "@/app/actions/team-overview";
import type { TeamOverviewScope } from "@/lib/team-hierarchy-types";
import type { TeamOverviewBriefingCopy } from "@/lib/team-overview-page-model";
import { SkeletonBlock } from "@/app/components/Skeleton";

export function TeamOverviewBriefing({
  briefing,
  kpis,
  scope,
  loading,
}: {
  briefing: TeamOverviewBriefingCopy;
  kpis: TeamOverviewKpis | null;
  scope: TeamOverviewScope;
  loading: boolean;
}) {
  return (
    <section
      className="mb-8 overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-slate-50/60 to-indigo-50/40 shadow-sm ring-1 ring-slate-900/[0.03]"
      aria-labelledby="team-briefing-heading"
    >
      {/* Top accent line */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

      <div className="px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
        <div className="mb-5 max-w-3xl">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600/90">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />
            {scope === "me" ? "Váš přehled" : "Týmový přehled"}
          </p>
          <h2
            id="team-briefing-heading"
            className="text-2xl font-black tracking-tight text-[color:var(--wp-text)] sm:text-3xl"
          >
            {briefing.headline}
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--wp-text-secondary)]">
            {briefing.lead}
          </p>
        </div>

        {kpis ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Lidé */}
            <div className="flex flex-col gap-1 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
                {scope === "me" ? "Rozsah" : "Lidé v rozsahu"}
              </p>
              <p className="text-3xl font-black tabular-nums text-[color:var(--wp-text)] leading-none">
                {kpis.memberCount}
              </p>
              <p className="text-xs text-[color:var(--wp-text-tertiary)]">
                {scope === "full" ? "Celá struktura" : scope === "my_team" ? "Můj tým" : "Osobní"}
              </p>
            </div>

            {/* Pozornost */}
            <div
              className={clsx(
                "flex flex-col gap-1 rounded-xl border px-4 py-3.5 shadow-sm",
                briefing.attentionCount > 0
                  ? "border-amber-200/90 bg-amber-50/80"
                  : "border-emerald-200/70 bg-emerald-50/50"
              )}
            >
              <p
                className={clsx(
                  "text-[10px] font-black uppercase tracking-wider",
                  briefing.attentionCount > 0 ? "text-amber-900/90" : "text-emerald-900/80"
                )}
              >
                Vyžaduje pozornost
              </p>
              <p
                className={clsx(
                  "text-3xl font-black tabular-nums leading-none",
                  briefing.attentionCount > 0 ? "text-amber-950" : "text-emerald-900"
                )}
              >
                {briefing.attentionCount}
              </p>
              <p
                className={clsx(
                  "text-xs",
                  briefing.attentionCount > 0
                    ? "text-amber-800/80"
                    : "text-emerald-800/70"
                )}
              >
                {briefing.attentionCount > 0
                  ? "Signály — krátká reakce pomůže"
                  : "Žádné naléhavé signály"}
              </p>
            </div>

            {/* Adaptace */}
            <div className="flex flex-col gap-1 rounded-xl border border-blue-200/70 bg-blue-50/50 px-4 py-3.5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-900/80">
                V adaptaci
              </p>
              <p className="text-3xl font-black tabular-nums text-blue-950 leading-none">
                {kpis.newcomersInAdaptation}
              </p>
              <p className="text-xs text-blue-800/70">
                {kpis.newcomersInAdaptation === 0
                  ? "Žádný nováček v okně 90 dní"
                  : kpis.newcomersInAdaptation === 1
                    ? "Nováček potřebuje klidný rytmus"
                    : "Nováčci potřebují klidný rytmus"}
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : null}

        {(briefing.teamStandingLine || briefing.weeklySnapshotLine) && (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-200/50 pt-4">
            {briefing.teamStandingLine && (
              <p className="text-sm font-semibold text-[color:var(--wp-text)]">{briefing.teamStandingLine}</p>
            )}
            {briefing.weeklySnapshotLine && (
              <p className="text-sm text-[color:var(--wp-text-secondary)]">{briefing.weeklySnapshotLine}</p>
            )}
          </div>
        )}

        {briefing.valueFramingLine && (
          <p className="mt-3 border-l-2 border-indigo-200 pl-3 text-[11px] leading-relaxed text-[color:var(--wp-text-tertiary)]">
            {briefing.valueFramingLine}
          </p>
        )}
      </div>
    </section>
  );
}
