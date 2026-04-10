"use client";

import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { TeamOverviewPageModel } from "@/lib/team-overview-page-model";

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

export function TeamOverviewCareerSummarySection({
  members,
  pageModel,
  displayName,
  selectMember,
}: {
  members: TeamMemberInfo[];
  pageModel: TeamOverviewPageModel;
  displayName: (m: TeamMemberInfo) => string;
  selectMember: (userId: string) => void;
}) {
  if (members.length === 0) return null;

  const hasTracks = pageModel.careerTeamSummary.byTrack.length > 0;

  return (
    <section
      className="mb-8 overflow-hidden rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-50/30 via-[color:var(--wp-surface-card)] to-[color:var(--wp-surface-card)] shadow-sm ring-1 ring-violet-900/[0.03]"
      aria-labelledby="team-career-growth-heading"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-200/40 bg-violet-50/30 px-5 py-3.5 sm:px-6">
        <h2
          id="team-career-growth-heading"
          className="flex items-center gap-2 text-base font-black text-[color:var(--wp-text)]"
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

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-12">
        {/* Větve */}
        <div className="lg:col-span-4 space-y-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
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
          <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/35 px-3 py-2.5 text-xs space-y-1.5 mt-1">
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
          <p className="text-[10px] font-black uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
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
          <p className="text-[10px] font-black uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
            Doporučená 1:1 (kariéra)
          </p>
          {pageModel.careerTeamSummary.topAttention.length === 0 ? (
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 px-3 py-3">
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
                      className="group block w-full text-left rounded-xl border border-violet-200/40 bg-violet-50/30 px-3 py-2.5 transition hover:border-violet-300 hover:bg-violet-50/70"
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
        <div className="mx-5 mb-5 rounded-xl border border-amber-200/60 bg-amber-50/40 px-4 py-2.5 sm:mx-6 sm:mb-6">
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
