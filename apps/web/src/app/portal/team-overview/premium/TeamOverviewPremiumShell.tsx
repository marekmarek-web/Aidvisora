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
        <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 md:px-4 md:py-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-slate-950 md:text-xl">{title}</h1>
              <p className="mt-0.5 max-w-xl text-xs text-slate-600 md:text-sm">{subtitle}</p>
            </div>

            <div className="flex flex-col gap-1.5 xl:items-end">
              <PremiumToggleGroup items={scopeItems} active={scopeActive} onChange={onScopeItemChange} />
              <div className="flex flex-wrap gap-2">
                <PremiumToggleGroup items={periodItems} active={periodActive} onChange={onPeriodItemChange} />
                <PremiumToggleGroup items={viewItems} active={viewActive} onChange={onViewChange} />
                <Link
                  href={teamManagementHref}
                  onClick={onTeamManagementOpen}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                  Správa týmu
                </Link>
                {calendarActions}
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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

        <div className="grid gap-3 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="min-w-0 space-y-3">{children}</div>
          <aside className="min-w-0 space-y-3 xl:sticky xl:top-6 xl:self-start">{aside}</aside>
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
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500">
            <span>{periodLabel}</span>
            <span>&middot;</span>
            <span>{scopeLabel}</span>
          </div>
          <h2 className="mt-1.5 text-base font-semibold tracking-tight text-slate-950 md:text-lg">
            Souhrn
          </h2>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
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

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Priority</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Aktuálně v rozsahu.</p>
            </div>
          </div>
          <div className="mt-2.5 space-y-2">
            {priorityItems.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                Žádné další priority v tomto rozsahu (nebo je zvolený pohled „Já“).
              </div>
            ) : (
              priorityItems.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-3">
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
