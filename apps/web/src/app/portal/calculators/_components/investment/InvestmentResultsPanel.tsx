"use client";

import { formatCurrency } from "@/lib/calculators/investment/formatters";
import { CalculatorResultsCard } from "../core/CalculatorResultsCard";

export interface InvestmentResultsPanelProps {
  totalBalance: number;
  totalInvested: number;
  totalGain: number;
  totalGainPercent: number;
  /** Optional: when provided, CTA button is shown (web/lead mode). */
  onCtaClick?: () => void;
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
        onCtaClick != null ? (
          <>
            <button
              type="button"
              onClick={onCtaClick}
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[14px] bg-[#2563eb] px-6 py-4 text-white shadow-lg transition-all hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1f4e]"
            >
              <span className="text-base uppercase">Chci investiční plán</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <p className="text-xs text-[color:var(--wp-text-secondary)] mt-4 text-center leading-relaxed opacity-60">
              Historické výnosy nejsou zárukou budoucích. Výpočty jsou orientační.
            </p>
          </>
        ) : undefined
      }
    />
  );
}
