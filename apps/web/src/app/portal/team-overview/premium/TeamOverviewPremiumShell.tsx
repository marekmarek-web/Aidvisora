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
      <div className="mx-auto max-w-[1640px] p-5 xl:p-6">
        <div className="mb-6 rounded-[36px] border border-white/90 bg-[#f7f8fb] px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-5">
                  <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[20px] bg-[#16192b] text-white shadow-[0_18px_40px_rgba(22,25,43,0.22)]">
                    <Sparkles className="h-8 w-8" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-500">
                      AIDVISORA CRM PORTAL
                    </p>
                    <h1 className="mt-2 text-[34px] font-black leading-none tracking-tight text-[#16192b]">
                      {title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-[14px] font-semibold leading-6 text-slate-600">
                      {subtitle}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-end gap-2">
                {showTeamManagementQuickLink ? (
                  <Link
                    href={teamManagementHref}
                    onClick={onTeamManagementOpen}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:bg-slate-50"
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
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  aria-label="Obnovit data"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                  Obnovit
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <PremiumToggleGroup items={scopeItems} active={scopeActive} onChange={onScopeItemChange} />
                <PremiumToggleGroup items={periodItems} active={periodActive} onChange={onPeriodItemChange} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-0">
              {viewItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onViewChange(item)}
                  className={`relative px-3 py-4 text-[15px] font-extrabold transition-all md:px-5 ${
                    viewActive === item ? "text-[#16192b]" : "text-slate-400 hover:text-[#16192b]"
                  }`}
                >
                  {item}
                  {viewActive === item ? (
                    <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-t-full bg-[#16192b]" />
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
    <section className="rounded-[32px] border border-slate-200/80 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
            <span>{periodLabel}</span>
            <span>&middot;</span>
            <span>{scopeLabel}</span>
          </div>
          <h2 className="mt-3 max-w-4xl text-[30px] font-black tracking-tight text-slate-950 md:text-[34px]">
            Tým roste ve výkonu, ale několik lidí stále vyžaduje manažerský zásah a pravidelný follow-up.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Pracovní briefing pro aktuální rozsah: držte tempo u lidí v riziku, sledujte adaptaci a posouvejte kariérní kroky.
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
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
            Briefing notes
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">Aktuálně v rozsahu</p>
          <div className="mt-4 space-y-2.5">
            {priorityItems.length === 0 ? (
              <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Bez dalších výjimek v tomto rozsahu.
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
