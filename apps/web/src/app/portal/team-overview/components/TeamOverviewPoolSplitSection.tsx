"use client";

import { Layers } from "lucide-react";
import type { TeamOverviewKpis } from "@/app/actions/team-overview";
import type { TeamOverviewPageModel } from "@/lib/team-overview-page-model";
import { poolCardUnitsFootnote, poolProgramLabel, poolUnitsLineLabel } from "@/lib/team-overview-format";

export function TeamOverviewPoolSplitSection({ kpis, pageModel }: { kpis: TeamOverviewKpis | null; pageModel: TeamOverviewPageModel }) {
  return (
    <section
      className="mb-8 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-[color:var(--wp-surface-card)] to-[color:var(--wp-surface-card)] p-5 shadow-sm sm:p-6"
      aria-labelledby="team-pool-heading"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 id="team-pool-heading" className="flex items-center gap-2 text-lg font-bold text-[color:var(--wp-text)] sm:text-xl">
            <Layers className="h-5 w-5 shrink-0 text-slate-600" />
            Role vs kariéra · rozdělení poolů
          </h2>
          <p className="mt-1 text-xs text-[color:var(--wp-text-secondary)] sm:text-sm">
            Systémová role v CRM je oddělená od kariérního programu a větve. Beplan a Premium Brokers zobrazujeme zvlášť — nesléváme je do jednoho modelu. Jednotky níže v tabulce jsou z CRM; u Beplanu je neinterpretujte jako BJ, u Premium Brokers ne jako BJS.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/55 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-900/85">{poolProgramLabel("beplan")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[color:var(--wp-text)]">{pageModel.poolSplit.counts.beplan}</p>
          <p className="text-xs text-[color:var(--wp-text-secondary)]">členů s programem Beplan v rozsahu</p>
          <p className="mt-3 text-sm text-[color:var(--wp-text-secondary)]">
            {poolUnitsLineLabel(kpis?.periodLabel ?? "období")}:{" "}
            <strong className="text-[color:var(--wp-text)] tabular-nums">{pageModel.poolSplit.units.beplan}</strong>
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--wp-text-tertiary)] leading-snug">{poolCardUnitsFootnote("beplan")}</p>
        </div>
        <div className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-900/85">{poolProgramLabel("premium_brokers")}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[color:var(--wp-text)]">{pageModel.poolSplit.counts.premium_brokers}</p>
          <p className="text-xs text-[color:var(--wp-text-secondary)]">členů s programem Premium Brokers v rozsahu</p>
          <p className="mt-3 text-sm text-[color:var(--wp-text-secondary)]">
            {poolUnitsLineLabel(kpis?.periodLabel ?? "období")}:{" "}
            <strong className="text-[color:var(--wp-text)] tabular-nums">{pageModel.poolSplit.units.premium_brokers}</strong>
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--wp-text-tertiary)] leading-snug">{poolCardUnitsFootnote("premium_brokers")}</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/35 px-4 py-3 text-xs text-[color:var(--wp-text-secondary)] space-y-1">
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Kariérní program nevyplněn:</span> {pageModel.poolSplit.counts.not_set}{" "}
          {pageModel.poolSplit.counts.not_set === 1 ? "osoba" : "lidí"}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Neznámý nebo nestandardní záznam:</span> {pageModel.poolSplit.counts.other}
        </p>
      </div>
    </section>
  );
}
