"use client";

import { Layers } from "lucide-react";
import type { TeamOverviewKpis } from "@/app/actions/team-overview";
import type { TeamOverviewPageModel } from "@/lib/team-overview-page-model";
import { poolCardUnitsFootnote, poolProgramLabel, poolUnitsLineLabel } from "@/lib/team-overview-format";

export function TeamOverviewPoolSplitSection({
  kpis,
  pageModel,
}: {
  kpis: TeamOverviewKpis | null;
  pageModel: TeamOverviewPageModel;
}) {
  const notSetCount = pageModel.poolSplit.counts.not_set;
  const otherCount = pageModel.poolSplit.counts.other;

  return (
    <section
      className="mb-8 overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/80 via-[color:var(--wp-surface-card)] to-[color:var(--wp-surface-card)] shadow-sm"
      aria-labelledby="team-pool-heading"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/60 bg-slate-50/60 px-5 py-3.5 sm:px-6">
        <Layers className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <h2
          id="team-pool-heading"
          className="text-base font-black text-[color:var(--wp-text)]"
        >
          Rozdělení poolů
        </h2>
        <p className="ml-auto text-[11px] text-[color:var(--wp-text-tertiary)] max-w-sm text-right hidden sm:block">
          Beplan a Premium Brokers zobrazujeme odděleně — jednotky jsou z CRM.
        </p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
        {/* Beplan */}
        <div className="flex flex-col rounded-xl border border-indigo-200/60 bg-indigo-50/50 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-900/80">
            {poolProgramLabel("beplan")}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-[color:var(--wp-text)] leading-none">
            {pageModel.poolSplit.counts.beplan}
          </p>
          <p className="mt-0.5 text-xs text-indigo-800/70">
            {pageModel.poolSplit.counts.beplan === 1 ? "člen" : "členů"} v rozsahu
          </p>
          <div className="mt-3 pt-3 border-t border-indigo-200/40 text-xs text-[color:var(--wp-text-secondary)]">
            <span>{poolUnitsLineLabel(kpis?.periodLabel ?? "období")}: </span>
            <strong className="text-[color:var(--wp-text)] tabular-nums">
              {pageModel.poolSplit.units.beplan}
            </strong>
          </div>
          <p className="mt-1.5 text-[11px] text-[color:var(--wp-text-tertiary)] leading-snug">
            {poolCardUnitsFootnote("beplan")}
          </p>
        </div>

        {/* Premium Brokers */}
        <div className="flex flex-col rounded-xl border border-violet-200/60 bg-violet-50/45 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-900/80">
            {poolProgramLabel("premium_brokers")}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-[color:var(--wp-text)] leading-none">
            {pageModel.poolSplit.counts.premium_brokers}
          </p>
          <p className="mt-0.5 text-xs text-violet-800/70">
            {pageModel.poolSplit.counts.premium_brokers === 1 ? "člen" : "členů"} v rozsahu
          </p>
          <div className="mt-3 pt-3 border-t border-violet-200/40 text-xs text-[color:var(--wp-text-secondary)]">
            <span>{poolUnitsLineLabel(kpis?.periodLabel ?? "období")}: </span>
            <strong className="text-[color:var(--wp-text)] tabular-nums">
              {pageModel.poolSplit.units.premium_brokers}
            </strong>
          </div>
          <p className="mt-1.5 text-[11px] text-[color:var(--wp-text-tertiary)] leading-snug">
            {poolCardUnitsFootnote("premium_brokers")}
          </p>
        </div>
      </div>

      {(notSetCount > 0 || otherCount > 0) && (
        <div className="mx-5 mb-5 flex flex-wrap gap-4 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/30 px-4 py-2.5 text-xs text-[color:var(--wp-text-secondary)] sm:mx-6 sm:mb-6">
          {notSetCount > 0 && (
            <p>
              <span className="font-semibold text-[color:var(--wp-text)]">Nevyplněno: </span>
              {notSetCount} {notSetCount === 1 ? "osoba" : "lidí"}
            </p>
          )}
          {otherCount > 0 && (
            <p>
              <span className="font-semibold text-[color:var(--wp-text)]">Ostatní / nestandardní: </span>
              {otherCount}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
