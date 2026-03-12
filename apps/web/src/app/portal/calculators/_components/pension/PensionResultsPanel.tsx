"use client";

import { formatCurrency } from "@/lib/calculators/pension/formatters";
import type { PensionResult } from "@/lib/calculators/pension/pension.types";

export interface PensionResultsPanelProps {
  result: PensionResult;
  onCtaPrimary: () => void;
}

export function PensionResultsPanel({ result, onCtaPrimary }: PensionResultsPanelProps) {
  const targetCapitalMillions =
    result.targetCapital > 0
      ? (result.targetCapital / 1_000_000).toFixed(1)
      : "0,0";

  return (
    <div className="bg-[#0a0f29] text-white rounded-2xl shadow-2xl shadow-[#0a0f29]/30 border border-slate-800 p-6 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#0B3A7A] opacity-20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#fbbf24] opacity-10 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none" />

      <h3 className="text-slate-400 font-medium mb-6 relative z-10 text-sm uppercase tracking-wider">
        Výsledek
      </h3>

      <div className="space-y-6 relative z-10">
        <div>
          <div className="text-slate-400 text-sm font-medium mb-1">
            Chybí vám měsíčně
          </div>
          <div className="text-3xl md:text-4xl font-extrabold text-[#fbbf24] tracking-tight">
            {formatCurrency(result.monthlyGap)} Kč
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-300 text-sm">Nutno investovat dnes</span>
            <span className="text-xl font-bold text-white">
              {formatCurrency(Math.round(result.monthlyInvestment))} Kč
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-300 text-sm">
              Cílový majetek v 65 letech
            </span>
            <span className="text-xl font-bold text-white">
              {targetCapitalMillions} mil. Kč
            </span>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={onCtaPrimary}
            className="group relative w-full bg-gradient-to-r from-[#fbbf24] to-[#fde047] hover:to-[#fbbf24] text-[#0a0f29] font-extrabold py-5 px-6 rounded-xl shadow-lg shadow-[#fbbf24]/30 transition-all transform hover:scale-[1.02] overflow-hidden min-h-[48px]"
          >
            <div className="relative flex items-center justify-center gap-3">
              <span className="text-lg">Chci tento plán nastavit</span>
              <svg
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </div>
          </button>
          <p className="text-xs text-slate-500 mt-3 text-center leading-relaxed">
            Výpočet předpokládá zhodnocení 7 % p.a. (akciové trhy).
          </p>
        </div>
      </div>
    </div>
  );
}
