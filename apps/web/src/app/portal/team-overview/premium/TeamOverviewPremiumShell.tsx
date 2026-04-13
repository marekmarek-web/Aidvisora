"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles, UserPlus, RefreshCw } from "lucide-react";
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
    <div className="min-h-screen bg-[#f4f5f8] text-slate-900">
      <div className="mx-auto max-w-[1640px] p-4 md:p-5 xl:p-6">
        <div className="mb-5 rounded-[32px] border border-white/80 bg-[#f7f8fb] px-5 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] md:px-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-5">
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-[#16192b] text-white shadow-xl shadow-[#16192b]/20">
                  <Sparkles className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[24px] font-black leading-none tracking-tight text-[#16192b] md:text-[30px]">{title}</h1>
                  <p className="mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">
                    Aidvisora CRM Portal
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap items-center gap-4">
                  <PremiumToggleGroup items={scopeItems} active={scopeActive} onChange={onScopeItemChange} />
                  <PremiumToggleGroup items={periodItems} active={periodActive} onChange={onPeriodItemChange} />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {showTeamManagementQuickLink ? (
                    <Link
                      href={teamManagementHref}
                      onClick={onTeamManagementOpen}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:bg-slate-50"
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
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                    aria-label="Obnovit data"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                    Obnovit
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200/70 pb-0">
              {viewItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onViewChange(item)}
                  className={`relative px-4 py-4 text-[15px] font-extrabold transition-all md:px-6 ${
                    viewActive === item ? "text-[#16192b]" : "text-slate-400 hover:text-[#16192b]"
                  }`}
                >
                  {item}
                  {viewActive === item ? (
                    <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-t-full bg-[#16192b] shadow-[0_-2px_10px_rgba(22,25,43,0.35)]" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        {runtimeChecksSlot}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.48fr)_400px]">
          <div className="min-w-0 space-y-5">{children}</div>
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
    <section className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:p-7">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
            <span>{periodLabel}</span>
            <span>&middot;</span>
            <span>{scopeLabel}</span>
          </div>
          <h2 className="mt-3 text-[28px] font-black tracking-tight text-slate-950 md:text-[34px]">
            Kondice týmu
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Souhrnný briefing pro aktuální rozsah s prioritami z kariéry, adaptace a rytmu práce.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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

        <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Priority</p>
              <p className="mt-1 text-sm font-bold text-slate-900">Aktuálně v rozsahu</p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {priorityItems.length === 0 ? (
              <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Žádné další priority v tomto rozsahu (nebo je zvolený pohled „Já“).
              </div>
            ) : (
              priorityItems.map((item) => (
                <div key={item.title} className="rounded-[18px] border border-slate-200 bg-white p-4 transition hover:border-slate-300">
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">{item.subtitle}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
