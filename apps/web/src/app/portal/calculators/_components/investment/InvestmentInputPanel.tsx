"use client";

import { formatCurrency, parseCurrency } from "@/lib/calculators/investment/formatters";
import { INVESTMENT_DEFAULTS } from "@/lib/calculators/investment/investment.config";

export interface InvestmentInputPanelProps {
  initial: number;
  monthly: number;
  years: number;
  onInitialChange: (v: number) => void;
  onMonthlyChange: (v: number) => void;
  onYearsChange: (v: number) => void;
  profileTitle: string;
  profileDescription: string;
}

export function InvestmentInputPanel({
  initial,
  monthly,
  years,
  onInitialChange,
  onMonthlyChange,
  onYearsChange,
  profileTitle,
  profileDescription,
}: InvestmentInputPanelProps) {
  const clampInitial = (v: number) =>
    Math.min(
      INVESTMENT_DEFAULTS.initialMax,
      Math.max(INVESTMENT_DEFAULTS.initialMin, v),
    );
  const clampMonthly = (v: number) =>
    Math.min(
      INVESTMENT_DEFAULTS.monthlyMax,
      Math.max(INVESTMENT_DEFAULTS.monthlyMin, v),
    );
  const clampYears = (v: number) =>
    Math.min(
      INVESTMENT_DEFAULTS.yearsMax,
      Math.max(INVESTMENT_DEFAULTS.yearsMin, v),
    );

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[#D6E6FF]/60">
      <div className="mb-8">
        <div className="flex justify-between items-end mb-4">
          <label className="text-sm font-bold text-slate-600 tracking-wide">
            <span className="uppercase">Počáteční vklad</span>{" "}
            <span className="text-slate-400 font-normal normal-case">(v Kč)</span>
          </label>
          <input
            type="text"
            value={formatCurrency(initial)}
            onChange={(e) =>
              onInitialChange(clampInitial(parseCurrency(e.target.value)))
            }
            className="text-right font-extrabold text-3xl text-[#0a0f29] border-b-2 border-slate-200 focus:border-[#fbbf24] outline-none w-56 bg-transparent transition-colors p-1"
          />
        </div>
        <input
          type="range"
          min={INVESTMENT_DEFAULTS.initialMin}
          max={INVESTMENT_DEFAULTS.initialMax}
          step={INVESTMENT_DEFAULTS.initialStep}
          value={initial}
          onChange={(e) =>
            onInitialChange(clampInitial(parseInt(e.target.value, 10)))}
          className="w-full min-h-[28px] touch-manipulation"
        />
        <div className="flex justify-between text-xs font-medium text-slate-400 mt-2">
          <span>0 Kč</span>
          <span>2 mil.</span>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-end mb-4">
          <label className="text-sm font-bold text-slate-600 tracking-wide">
            <span className="uppercase">Měsíční investice</span>{" "}
            <span className="text-slate-400 font-normal normal-case">(v Kč)</span>
          </label>
          <input
            type="text"
            value={formatCurrency(monthly)}
            onChange={(e) =>
              onMonthlyChange(clampMonthly(parseCurrency(e.target.value)))
            }
            className="text-right font-extrabold text-3xl text-[#0a0f29] border-b-2 border-slate-200 focus:border-[#fbbf24] outline-none w-56 bg-transparent transition-colors p-1"
          />
        </div>
        <input
          type="range"
          min={INVESTMENT_DEFAULTS.monthlyMin}
          max={INVESTMENT_DEFAULTS.monthlyMax}
          step={INVESTMENT_DEFAULTS.monthlyStep}
          value={monthly}
          onChange={(e) =>
            onMonthlyChange(clampMonthly(parseInt(e.target.value, 10)))}
          className="w-full min-h-[28px] touch-manipulation"
        />
        <div className="flex justify-between text-xs font-medium text-slate-400 mt-2">
          <span>500 Kč</span>
          <span>50 tis.</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-600 mb-4 uppercase tracking-wide">
          Doba investice
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={INVESTMENT_DEFAULTS.yearsMin}
            max={INVESTMENT_DEFAULTS.yearsMax}
            step={1}
            value={years}
            onChange={(e) =>
              onYearsChange(clampYears(parseInt(e.target.value, 10)))}
            className="flex-1 min-h-[28px] touch-manipulation"
          />
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-[#0a0f29] min-w-[80px] text-center">
            {years} let
          </div>
        </div>
        <div className="flex justify-between text-xs font-medium text-slate-400 mt-2">
          <span>3 roky</span>
          <span>30 let</span>
        </div>
      </div>

      <div className="mt-8 bg-blue-50/50 border border-blue-100/50 rounded-xl p-4 flex items-start gap-3">
        <svg
          className="w-4 h-4 text-[#0B3A7A] mt-1 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="text-sm text-slate-600">
          <strong className="block text-[#0a0f29] mb-1">{profileTitle}</strong>
          <span>{profileDescription}</span>
        </div>
      </div>
    </div>
  );
}
