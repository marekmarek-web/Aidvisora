"use client";

import { formatCurrency, formatRate } from "@/lib/calculators/mortgage/formatters";
import { CalculatorResultsCard } from "../core/CalculatorResultsCard";
import type { MortgageResult } from "@/lib/calculators/mortgage/mortgage.types";

export interface MortgageResultsPanelProps {
  result: MortgageResult;
  /** Optional: when provided, CTA button is shown (web/lead mode). */
  onCtaClick?: () => void;
}

export function MortgageResultsPanel({ result, onCtaClick }: MortgageResultsPanelProps) {
  const rows: { label: string; value: string; highlight?: "gain" | "percent" }[] = [
    { label: "Odhad úroku", value: formatRate(result.finalRate) },
  ];
  if (result.showLtvRow) {
    rows.push({
      label: result.ltvLabel,
      value: `${result.displayLtv} %`,
    });
  }
  rows.push({
    label: "Celkem zaplatíte",
    value: `${formatCurrency(result.totalPaid)} Kč`,
  });

  return (
    <CalculatorResultsCard
      valueLabel="Měsíční splátka"
      value={formatCurrency(result.monthlyPayment)}
      unit="Kč"
      rows={rows}
      footnote="Výpočet je orientační. Skutečná sazba a splátka závisí na bance a vaší bonitě."
      cta={
        onCtaClick != null ? (
          <>
            <button
              type="button"
              onClick={onCtaClick}
              className="group relative w-full bg-gradient-to-r from-[#fbbf24] to-[#fde047] hover:to-[#fbbf24] text-[#0a0f29] font-extrabold py-5 px-6 rounded-xl shadow-lg shadow-[#fbbf24]/30 transition-all transform hover:scale-[1.02] overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-white/30 skew-x-[-20deg] animate-shimmer" />
              <div className="relative flex items-center justify-center gap-3">
                <span className="text-lg uppercase">Chci nezávaznou nabídku</span>
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform"
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
            <p className="text-xs text-slate-500 mt-4 text-center leading-relaxed opacity-60">
              Srovnání nabídek bez závazku. Kontaktujeme vás pouze na vyžádání.
            </p>
          </>
        ) : undefined
      }
    />
  );
}
