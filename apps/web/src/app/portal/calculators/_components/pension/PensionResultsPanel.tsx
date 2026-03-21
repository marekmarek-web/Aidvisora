"use client";

import { formatCurrency } from "@/lib/calculators/pension/formatters";
import type { PensionResult } from "@/lib/calculators/pension/pension.types";

export interface PensionResultsPanelProps {
  result: PensionResult;
  /** Optional: when provided, CTA button is shown (web/lead mode). */
  onCtaPrimary?: () => void;
}

export function PensionResultsPanel({ result, onCtaPrimary }: PensionResultsPanelProps) {
  const targetCapitalMillions =
    result.targetCapital > 0
      ? (result.targetCapital / 1_000_000).toFixed(1)
      : "0,0";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0f29] p-6 text-white shadow-2xl shadow-[#0a0f29]/30 md:p-8">
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#0B3A7A] opacity-20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500 opacity-10 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none" />

      <h3 className="relative z-10 mb-6 text-sm font-medium uppercase tracking-wider text-slate-400">
        Výsledek
      </h3>

      <div className="space-y-6 relative z-10">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-1 text-sm font-medium text-slate-400">
            Chybí vám měsíčně
          </div>
          <div className="text-3xl md:text-4xl font-extrabold text-emerald-400 tracking-tight">
            {formatCurrency(result.monthlyGap)} Kč
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-slate-300">Nutno investovat dnes</span>
            <span className="text-xl font-bold text-white">
              {formatCurrency(Math.round(result.monthlyInvestment))} Kč
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-white/10 py-2">
            <span className="text-sm text-slate-300">
              Cílový majetek v 65 letech
            </span>
            <span className="text-xl font-bold text-white">
              {targetCapitalMillions} mil. Kč
            </span>
          </div>
        </div>

        <div className="pt-4">
          {onCtaPrimary != null && (
            <button
              type="button"
              onClick={onCtaPrimary}
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-6 py-5 font-extrabold text-white shadow-lg transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
            >
              <span className="text-lg">Chci tento plán nastavit</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          )}
          <p className="text-xs text-slate-500 mt-3 text-center leading-relaxed">
            Výpočet předpokládá zhodnocení 7 % p.a. (akciové trhy).
          </p>
        </div>
      </div>
    </div>
  );
}
