"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { UserPlus, RefreshCw } from "lucide-react";
import { PremiumMetricCard, PremiumToggleGroup } from "./primitives";
import { teamOverviewIcon } from "./icons";

type ShellProps = {
  title: string;
  subtitle: string;
  /** Scope labels pro ToggleGroup — např. Já / Můj tým */
  scopeItems: string[];
  scopeActive: string;
  onScopeItemChange: (label: string) => void;
  periodItems: string[];
  periodActive: string;
  onPeriodItemChange: (label: string) => void;
  viewItems: string[];
  viewActive: string;
  onViewChange: (label: string) => void;
  teamManagementHref: string;
  onTeamManagementOpen: () => void;
  /** Když je „Správa týmu“ samostatný tab, schovat duplicitní tlačítko v hlavičce. */
  showTeamManagementQuickLink?: boolean;
  calendarActions: ReactNode;
  onRefresh: () => void;
  loading: boolean;
  /** Dev-only panel */
  runtimeChecksSlot?: ReactNode;
  children: ReactNode;
  aside: ReactNode;
};

export function TeamOverviewPremiumShell({
  title,
  subtitle,
  scopeItems,
  scopeActive,
  onScopeItemChange,
  periodItems,
  periodActive,
  onPeriodItemChange,
  viewItems,
  viewActive,
  onViewChange,
  teamManagementHref,
  onTeamManagementOpen,
  showTeamManagementQuickLink = true,
  calendarActions,
  onRefresh,
  loading,
  runtimeChecksSlot,
  children,
  aside,
}: ShellProps) {
  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900">
      <div className="mx-auto max-w-[1600px] p-4 md:p-5 xl:p-6">
        <div className="mb-4 rounded-[28px] border border-slate-200/80 bg-white/95 px-4 py-4 shadow-sm backdrop-blur md:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Aidvisora CRM Portal</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-[2rem]">{title}</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <PremiumToggleGroup items={scopeItems} active={scopeActive} onChange={onScopeItemChange} />
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <PremiumToggleGroup items={periodItems} active={periodActive} onChange={onPeriodItemChange} />
                <PremiumToggleGroup items={viewItems} active={viewActive} onChange={onViewChange} />
                {showTeamManagementQuickLink ? (
                  <Link
                    href={teamManagementHref}
                    onClick={onTeamManagementOpen}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                    Správa týmu
                  </Link>
                ) : null}
                {calendarActions}
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Obnovit data"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                  Obnovit
                </button>
              </div>
            </div>
          </div>
        </div>

        {runtimeChecksSlot}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.78fr)]">
          <div className="min-w-0 space-y-4">{children}</div>
          <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">{aside}</aside>
        </div>
      </div>
    </div>
  );
}

/** Souhrnný blok týmu — metriky pouze z props (reálná data). */
export function TeamOverviewPremiumBriefingDark({
  periodLabel,
  scopeLabel,
  stats,
  priorityItems,
}: {
  periodLabel: string;
  scopeLabel: string;
  stats: {
    attention: number;
    adaptation: number;
    onTrack: number;
    managerial: number;
    performance: number;
  };
  priorityItems: { title: string; subtitle: string }[];
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>{periodLabel}</span>
            <span>&middot;</span>
            <span>{scopeLabel}</span>
          </div>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 md:text-[1.65rem]">
            Kondice týmu
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <PremiumMetricCard
              label="Vyžaduje pozornost"
              value={String(stats.attention)}
              change="CRM / kariérní signály"
              tone="warn"
              symbol={teamOverviewIcon("warning")}
            />
            <PremiumMetricCard
              label="Nováčci v adaptaci"
              value={String(stats.adaptation)}
              change="90d okno ve scope"
              tone="info"
              symbol="⌛"
            />
            <PremiumMetricCard
              label="Na dobré cestě"
              value={String(stats.onTrack)}
              change="dle kariérní evaluace"
              tone="success"
              symbol={teamOverviewIcon("trend")}
            />
            <PremiumMetricCard
              label="Manažerská větev"
              value={String(stats.managerial)}
              change="větev struktury"
              tone="info"
              symbol="M"
            />
            <PremiumMetricCard
              label="Výkon + specialisté"
              value={String(stats.performance)}
              change="výkonové větve"
              tone="success"
              symbol="TP"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Priority</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Aktuálně v rozsahu</p>
            </div>
          </div>
          <div className="mt-3 space-y-2.5">
            {priorityItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-slate-600">
                Žádné další priority v tomto rozsahu (nebo je zvolený pohled „Já“).
              </div>
            ) : (
              priorityItems.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.subtitle}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
