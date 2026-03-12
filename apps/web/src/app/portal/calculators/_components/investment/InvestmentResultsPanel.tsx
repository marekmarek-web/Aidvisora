"use client";

import { formatCurrency } from "@/lib/calculators/investment/formatters";
import { CalculatorResultsCard } from "../core/CalculatorResultsCard";

export interface InvestmentResultsPanelProps {
  totalBalance: number;
  totalInvested: number;
  totalGain: number;
  totalGainPercent: number;
  onCtaClick: () => void;
}

export function InvestmentResultsPanel({
  totalBalance,
  totalInvested,
  totalGain,
  totalGainPercent,
  onCtaClick,
}: InvestmentResultsPanelProps) {
  const rows = [
    { label: "Váš vklad", value: `${formatCurrency(Math.round(totalInvested))} Kč` },
    {
      label: "Zisk z investice",
      value: `+${formatCurrency(Math.round(totalGain))} Kč`,
      highlight: "gain" as const,
    },
    {
      label: "Zhodnocení",
      value: `+${totalGainPercent.toFixed(1)} %`,
      highlight: "percent" as const,
    },
  ];

  return (
    <CalculatorResultsCard
      valueLabel="Předpokládaná hodnota"
      value={formatCurrency(Math.round(totalBalance))}
      unit="Kč"
      rows={rows}
      footnote="Výsledky vycházejí z modelového výpočtu a slouží pro ilustraci dlouhodobého vývoje investice."
      cta={
        <>
          <button
            type="button"
            onClick={onCtaClick}
            className="group relative w-full bg-gradient-to-r from-[#fbbf24] to-[#fde047] hover:to-[#fbbf24] text-[#0a0f29] font-extrabold py-5 px-6 rounded-xl shadow-lg shadow-[#fbbf24]/30 transition-all transform hover:scale-[1.02] overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-white/30 skew-x-[-20deg] animate-shimmer" />
            <div className="relative flex items-center justify-center gap-3">
              <span className="text-lg uppercase">Chci investiční plán</span>
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
            Historické výnosy nejsou zárukou budoucích. Výpočty jsou orientační.
          </p>
        </>
      }
    />
  );
}
