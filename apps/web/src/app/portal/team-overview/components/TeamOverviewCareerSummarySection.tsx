"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { TeamOverviewPageModel } from "@/lib/team-overview-page-model";

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

  return (
    <section
      className="mb-8 rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/45 via-[color:var(--wp-surface-card)] to-[color:var(--wp-surface-card)] p-5 shadow-sm ring-1 ring-violet-900/[0.04] sm:p-6"
      aria-labelledby="team-career-growth-heading"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 id="team-career-growth-heading" className="flex items-center gap-2 text-lg font-bold text-[color:var(--wp-text)] sm:text-xl">
            <Briefcase className="h-5 w-5 shrink-0 text-violet-600" />
            Kariérní přehled týmu
          </h2>
          <p className="mt-1 text-xs text-[color:var(--wp-text-secondary)] sm:text-sm">
            Program, větev, pozice a stav evaluace z údajů v aplikaci — orientační, ne oficiální splnění řádu. Chybějící údaje bereme jako příležitost doplnit v Nastavení → Tým.
          </p>
        </div>
        <Link href="/portal/setup?tab=tym" className="text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline">
          Doplnit kariérní údaje
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">Podle větve</p>
          <ul className="space-y-1.5 text-sm">
            {pageModel.careerTeamSummary.byTrack.length === 0 ? (
              <li className="text-[color:var(--wp-text-secondary)]">
                Zatím bez rozlišených větví — doplněním údajů zpřesníte doporučení (Nastavení → Tým).
              </li>
            ) : (
              pageModel.careerTeamSummary.byTrack.map((t) => (
                <li key={t.trackId} className="flex justify-between gap-2 text-[color:var(--wp-text)]">
                  <span className="text-[color:var(--wp-text-secondary)] truncate">{t.label}</span>
                  <span className="font-semibold tabular-nums shrink-0">{t.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="lg:col-span-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">Stav podle přehledu</p>
          <ul className="space-y-1.5 text-sm">
            {(
              [
                "Na dobré cestě",
                "Vyžaduje doplnění",
                "Částečně vyhodnoceno",
                "Potřebuje pozornost",
                "Bez dostatku dat",
              ] as const
            ).map((label) => {
              const c = pageModel.careerTeamSummary.byManagerLabel[label] ?? 0;
              if (c === 0) return null;
              return (
                <li key={label} className="flex justify-between gap-2">
                  <span className="text-[color:var(--wp-text-secondary)]">{label}</span>
                  <span className="font-semibold tabular-nums">{c}</span>
                </li>
              );
            })}
          </ul>
          <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/40 px-3 py-2 text-xs text-[color:var(--wp-text-secondary)] space-y-1">
            <p>
              <span className="font-semibold text-[color:var(--wp-text)]">Chybí data / doplnění:</span>{" "}
              {pageModel.careerTeamSummary.needsAttentionDataCount}{" "}
              {pageModel.careerTeamSummary.needsAttentionDataCount === 1 ? "osoba" : "lidí"}
            </p>
            <p>
              <span className="font-semibold text-[color:var(--wp-text)]">Částečná nebo ruční část evaluace:</span>{" "}
              {pageModel.careerTeamSummary.manualOrPartialCount}
            </p>
            <p>
              <span className="font-semibold text-[color:var(--wp-text)]">Start + adaptace:</span>{" "}
              {pageModel.careerTeamSummary.startersInAdaptationCount}{" "}
              {pageModel.careerTeamSummary.startersInAdaptationCount === 1 ? "osoba" : "lidí"} na prvním kroku větve a v adaptačním okně
            </p>
          </div>
        </div>
        <div className="lg:col-span-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--wp-text-tertiary)] mb-2">Doporučené 1:1 (kariéra)</p>
          {pageModel.careerTeamSummary.topAttention.length === 0 ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3 text-sm text-[color:var(--wp-text-secondary)]">
              <p className="font-medium text-[color:var(--wp-text)]">Vyrovnaný přehled</p>
              <p className="mt-1 text-xs leading-relaxed">
                Z kariérního pohledu nikdo zásadně nevyčnívá — u malého týmu je to běžné. Udržujte pravidelný kontakt a sledujte signály výše.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pageModel.careerTeamSummary.topAttention.map((x) => {
                const mem = members.find((m) => m.userId === x.userId);
                const name = mem ? displayName(mem) : x.displayName || x.email || "Člen týmu";
                return (
                  <li key={x.userId}>
                    <button
                      type="button"
                      onClick={() => selectMember(x.userId)}
                      className="block w-full text-left rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-2 hover:border-violet-200 hover:bg-violet-50/30 transition"
                    >
                      <p className="font-medium text-sm text-[color:var(--wp-text)]">{name}</p>
                      <p className="text-[11px] text-violet-800/90 font-medium">{x.managerProgressLabel}</p>
                      <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5 line-clamp-2">{x.reason}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {pageModel.careerTeamSummary.byTrack.length === 0 && members.length > 0 ? (
        <div className="mt-5 rounded-xl border border-amber-200/60 bg-amber-50/35 px-4 py-3 text-sm text-amber-950/90">
          <span className="font-semibold">Příležitost doplnit data:</span> bez vyplněných kariérních větví zůstávají souhrny obecnější. Údaje doplníte v Nastavení → Tým.
        </div>
      ) : null}
    </section>
  );
}
