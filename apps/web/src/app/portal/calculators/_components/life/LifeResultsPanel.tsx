"use client";

import { formatCurrency } from "@/lib/calculators/life/formatters";
import { EUCS_LABELS } from "@/lib/calculators/life/life.config";
import type { LifeResult } from "@/lib/calculators/life/life.types";
import type { LifeState } from "@/lib/calculators/life/life.types";
import { Umbrella, Activity, HeartPulse, Zap, Scale } from "lucide-react";

export interface LifeResultsPanelProps {
  state: LifeState;
  result: LifeResult;
  /** Optional: when provided, CTA buttons are shown (web/lead mode). */
  onCtaPrimary?: () => void;
  onCtaCheck?: () => void;
}

function DeathSubtext(state: LifeState): string {
  const parts: string[] = [];
  if (state.hasSpouse) parts.push("manželky");
  if (state.children > 0) parts.push(`a ${state.children} dětí`);
  return parts.length ? `Včetně zabezpečení ${parts.join(" ")}` : "Včetně zabezpečení";
}

export function LifeResultsPanel({
  state,
  result,
  onCtaPrimary,
  onCtaCheck,
}: LifeResultsPanelProps) {
  const rows = [
    {
      label: "Smrt",
      value: result.deathCoverage,
      unit: "Kč",
      icon: Umbrella,
      subtext: DeathSubtext(state),
      highlight: false,
    },
    {
      label: "Invalidita III. + II. st.",
      value: result.capitalD3,
      unit: "Kč",
      icon: Activity,
      subtext: `Krytí renty ${formatCurrency(result.gapD3Renta)} Kč/měs`,
      highlight: true,
    },
    {
      label: "Pracovní neschopnost",
      value: result.pnDailyNeed,
      unit: "Kč / den",
      icon: HeartPulse,
      subtext: "Denní dávka (od 29. dne)",
      highlight: false,
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0f29] p-6 text-white shadow-2xl shadow-[#0a0f29]/30 md:p-8">
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#0B3A7A] opacity-20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500 opacity-10 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none" />

      <h3 className="relative z-10 mb-6 flex flex-wrap items-center justify-between gap-2 text-sm font-medium uppercase tracking-wider text-slate-400">
        Doporučené min. pojistné částky
        <span className="rounded bg-indigo-500/10 px-2 py-1 text-xs font-bold normal-case text-indigo-400">
          Klesající do 65 let
        </span>
      </h3>

      <div className="relative z-10 space-y-0 rounded-xl border border-white/10 bg-white/5 p-1.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className={`flex items-center justify-between rounded-lg border-b border-white/10 px-3 py-3 ${row.highlight ? "my-1 border-none bg-white/10" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${row.highlight ? "bg-emerald-500/20" : "bg-white/5"}`}
                >
                  <Icon
                    className={`w-5 h-5 ${row.highlight ? "text-red-400" : "text-slate-300"}`}
                  />
                </div>
                <div>
                  <div
                    className={`text-sm font-bold ${row.highlight ? "text-white" : "text-slate-200"}`}
                  >
                    {row.label}
                  </div>
                  <div className="text-xs text-slate-500">{row.subtext}</div>
                </div>
              </div>
                <div className="text-right pl-2">
                <div
                  className={`text-xl md:text-2xl font-bold tracking-tight ${row.highlight ? "text-emerald-400" : "text-white"}`}
                >
                  {formatCurrency(row.value)}
                </div>
                <div className="text-xs text-slate-500 uppercase font-bold">
                  {row.unit}
                </div>
              </div>
            </div>
          );
        })}

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-lg">
                <Zap className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="text-slate-300 text-sm font-medium">
                Trvalé následky
              </span>
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(result.tnBase)}
            </div>
          </div>
          <div className="flex justify-between items-center pl-11 flex-wrap gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Lineární plnění
            </span>
            <span className="text-[10px] text-indigo-500 font-bold bg-indigo-500/10 px-2 py-0.5 rounded">
              Až 10násobná progrese ({formatCurrency(result.tnProgression)})
            </span>
          </div>
        </div>

        <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden group hover:bg-white/10 transition-colors">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500 opacity-5 blur-xl -mr-5 -mt-5" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="bg-white p-2 rounded-lg shrink-0 w-12 h-12 flex items-center justify-center">
              <Scale className="w-6 h-6 text-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm mb-1">
                Právní ochrana EUCS
              </div>
              <p className="text-xs text-slate-300 leading-snug mb-2 pr-1">
                Zajistí, že vám pojišťovna vyplatí{" "}
                <strong>maximální plnění</strong>. Nutnost ke smlouvě.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-indigo-500">
                <span className="bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
                  {EUCS_LABELS.perPerson}
                </span>
                <span className="bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
                  {EUCS_LABELS.perFamily}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(onCtaPrimary != null || onCtaCheck != null) && (
        <div className="mt-8 relative z-10 space-y-3">
          {onCtaPrimary != null && (
            <button
              type="button"
              onClick={onCtaPrimary}
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-6 py-5 font-extrabold text-white shadow-lg transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
            >
              <span className="text-lg">Chci řešení na míru</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          )}
          {onCtaCheck != null && (
            <button
              type="button"
              onClick={onCtaCheck}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
            >
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Mám smlouvu ke kontrole
            </button>
          )}
          <p className="text-xs text-slate-500 mt-2 text-center leading-relaxed opacity-60">
            Kliknutím získáte nezávaznou konzultaci.
          </p>
        </div>
      )}
    </div>
  );
}
