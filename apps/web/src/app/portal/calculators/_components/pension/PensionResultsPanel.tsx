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
    <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0d1f4e] p-6 text-white shadow-[0_16px_48px_rgba(13,31,78,0.14),0_4px_12px_rgba(13,31,78,0.06)] md:p-7">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -mr-12 -mt-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -ml-10 -mb-10" />
      </div>

      <h3 className="relative z-10 mb-5 text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--wp-text-tertiary)]">
        Výsledek
      </h3>

      <div className="space-y-6 relative z-10">
        <div className="rounded-xl border border-white/10 bg-[color:var(--wp-surface-card)]/5 p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-[color:var(--wp-text-tertiary)]">
            Chybí vám měsíčně
          </div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-emerald-300 tracking-tight">
            {formatCurrency(result.monthlyGap)} Kč
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[color:var(--wp-surface-card)]/5 p-2">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-white/75">Nutno investovat dnes</span>
            <span className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(Math.round(result.monthlyInvestment))} Kč
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-white/10 py-2">
            <span className="text-sm text-white/75">
              Cílový majetek v 65 letech
            </span>
            <span className="text-lg sm:text-xl font-bold text-white">
              {targetCapitalMillions} mil. Kč
            </span>
          </div>
        </div>

        <div className="pt-4">
          {onCtaPrimary != null && (
            <button
              type="button"
              onClick={onCtaPrimary}
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[14px] bg-[#2563eb] px-6 py-4 font-bold text-white shadow-lg transition-all hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1f4e]"
            >
              <span className="text-sm sm:text-base">Chci tento plán nastavit</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          )}
          <p className="text-xs text-[color:var(--wp-text-tertiary)]/80 mt-3 text-center leading-relaxed">
            Výpočet předpokládá zhodnocení 7 % p.a. (akciové trhy).
          </p>
        </div>
      </div>
    </div>
  );
}
