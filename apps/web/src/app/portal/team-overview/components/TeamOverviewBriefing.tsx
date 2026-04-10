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
      className="mb-8 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/95 via-[color:var(--wp-surface-card)] to-indigo-50/30 p-5 sm:p-7 shadow-sm ring-1 ring-slate-900/[0.04]"
      aria-labelledby="team-briefing-heading"
    >
      <div className="mb-6 max-w-3xl">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-indigo-700/85">Tento týden v týmu</p>
        <h2 id="team-briefing-heading" className="text-2xl font-bold tracking-tight text-[color:var(--wp-text)] sm:text-3xl">
          {briefing.headline}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--wp-text-secondary)]">{briefing.lead}</p>
        <p className="mt-3 border-l-2 border-indigo-200 pl-3 text-xs leading-relaxed text-[color:var(--wp-text-tertiary)]">
          {briefing.valueFramingLine}
        </p>
      </div>
      {kpis ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
              {scope === "me" ? "V rozsahu" : "Lidé v rozsahu"}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-[color:var(--wp-text)]">{kpis.memberCount}</p>
            <p className="mt-1 text-xs text-[color:var(--wp-text-tertiary)]">
              {scope === "full" ? "Celá struktura" : scope === "my_team" ? "Můj tým" : "Osobní"}
            </p>
          </div>
          <div
            className={clsx(
              "rounded-xl border px-4 py-4 shadow-sm",
              briefing.attentionCount > 0 ? "border-amber-200/80 bg-amber-50/60" : "border-emerald-200/70 bg-emerald-50/40"
            )}
          >
            <p
              className={clsx(
                "text-[11px] font-bold uppercase tracking-wider",
                briefing.attentionCount > 0 ? "text-amber-900/85" : "text-emerald-900/80"
              )}
            >
              Vyžaduje pozornost
            </p>
            <p
              className={clsx(
                "mt-1 text-3xl font-bold tabular-nums",
                briefing.attentionCount > 0 ? "text-amber-950" : "text-emerald-900"
              )}
            >
              {briefing.attentionCount}
            </p>
            <p className="mt-1 text-xs text-[color:var(--wp-text-secondary)]">
              {briefing.attentionCount > 0 ? "CRM i kariéra — krátká reakce pomůže" : "Žádné naléhavé signály v tomto rozsahu"}
            </p>
          </div>
          <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 px-4 py-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-900/80">V adaptaci</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-blue-950">{kpis.newcomersInAdaptation}</p>
            <p className="mt-1 text-xs text-[color:var(--wp-text-secondary)]">Nováčci v okně adaptace</p>
          </div>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : null}
      {briefing.teamStandingLine ? (
        <p className="mt-5 text-sm text-[color:var(--wp-text)] border-t border-[color:var(--wp-surface-card-border)]/70 pt-4 font-medium">
          {briefing.teamStandingLine}
        </p>
      ) : null}
      {briefing.weeklySnapshotLine ? (
        <p className="mt-2 text-sm text-[color:var(--wp-text-secondary)]">{briefing.weeklySnapshotLine}</p>
      ) : null}
    </section>
  );
}
