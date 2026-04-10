"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { UserPlus, RefreshCw } from "lucide-react";
import { PremiumPill, PremiumSectionTitle, PremiumMetricCard, PremiumToggleGroup } from "./primitives";
import { teamOverviewIcon } from "./icons";
import { TEAM_OVERVIEW_GUIDING_QUESTIONS } from "./constants";

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
  calendarActions: ReactNode;
  onRefresh: () => void;
  loading: boolean;
  poolBeplanCount: number;
  poolPbCount: number;
  poolBeplanUnits: number;
  poolPbUnits: number;
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
  calendarActions,
  onRefresh,
  loading,
  poolBeplanCount,
  poolPbCount,
  poolBeplanUnits,
  poolPbUnits,
  runtimeChecksSlot,
  children,
  aside,
}: ShellProps) {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-[1600px] p-4 md:p-6 xl:p-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between md:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <PremiumPill tone="info">Týmový přehled</PremiumPill>
              <PremiumPill tone="default">Aidvisora</PremiumPill>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600 md:text-[15px]">{subtitle}</p>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <PremiumToggleGroup items={scopeItems} active={scopeActive} onChange={onScopeItemChange} />
            <div className="flex flex-wrap gap-2">
              <PremiumToggleGroup items={periodItems} active={periodActive} onChange={onPeriodItemChange} />
              <PremiumToggleGroup items={viewItems} active={viewActive} onChange={onViewChange} />
              <Link
                href={teamManagementHref}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                Pozvat člena
              </Link>
              {calendarActions}
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Obnovit data"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                Obnovit
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <PremiumSectionTitle
              symbol={teamOverviewIcon("question")}
              title="Na jaké otázky má tento modul odpovídat"
              subtitle="Orientační rámec — odpovědi vycházejí z dat v CRM a kariérním nastavení, ne z ukázkových čísel."
            />
            <div className="grid gap-3 md:grid-cols-2">
              {TEAM_OVERVIEW_GUIDING_QUESTIONS.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <PremiumSectionTitle
              symbol={teamOverviewIcon("pool")}
              title="Pool split a kariérní kontext"
              subtitle="Počty lidí a jednotky za období podle kariérního programu (skutečná data z přehledu)."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <PremiumMetricCard
                label="Beplan (lidé)"
                value={String(poolBeplanCount)}
                change={poolBeplanUnits > 0 ? `${poolBeplanUnits} jednotek v období (CRM)` : undefined}
                tone="info"
                symbol="B"
              />
              <PremiumMetricCard
                label="Premium Brokers (lidé)"
                value={String(poolPbCount)}
                change={poolPbUnits > 0 ? `${poolPbUnits} jednotek v období (CRM)` : undefined}
                tone="violet"
                symbol="PB"
              />
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Systémová role v aplikaci, kariérní program, větev a pozice jsou oddělené vrstvy — stejně jako v nastavení
              členů týmu.
            </div>
          </div>
        </div>

        {runtimeChecksSlot}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="min-w-0 space-y-6">{children}</div>
          <aside className="min-w-0 space-y-6 xl:sticky xl:top-8 xl:self-start">{aside}</aside>
        </div>
      </div>
    </div>
  );
}

/** Tmavý briefing blok — metriky pouze z props (reálná data). */
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
    <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-xl shadow-slate-900/10 md:p-6">
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PremiumPill tone="info">Manažerský briefing</PremiumPill>
            <PremiumPill tone="dark">{periodLabel}</PremiumPill>
            <PremiumPill tone="dark">{scopeLabel}</PremiumPill>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
            Co vyžaduje pozornost, kdo roste a co teď řešit
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-[15px]">
            Přehled vychází z metrik CRM, kariérního nastavení a adaptace — bez demo výplně.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
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
              change="structure track"
              tone="info"
              symbol="M"
            />
            <PremiumMetricCard
              label="Výkon + specialisté"
              value={String(stats.performance)}
              change="indiv. + reality + call centrum"
              tone="success"
              symbol="TP"
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Priority (z dat)</p>
              <p className="mt-1 text-xs text-slate-400">Jen pokud systém něco eviduje — jinak blok níže neuvidíte.</p>
            </div>
            <span className="text-lg text-slate-300">{teamOverviewIcon("spark")}</span>
          </div>
          <div className="mt-4 space-y-3">
            {priorityItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                Žádné další prioritní signály v tomto rozsahu — data jsou v klidu nebo je zvolený pohled „Já“.
              </div>
            ) : (
              priorityItems.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.subtitle}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
