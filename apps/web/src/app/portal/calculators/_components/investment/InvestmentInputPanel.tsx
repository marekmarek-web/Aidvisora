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

function sliderGradient(value: number, min: number, max: number): string {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(90deg, #2563eb 0%, #38bdf8 ${pct}%, #cbd5e1 ${pct}%)`;
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
    Math.min(INVESTMENT_DEFAULTS.initialMax, Math.max(INVESTMENT_DEFAULTS.initialMin, v));
  const clampMonthly = (v: number) =>
    Math.min(INVESTMENT_DEFAULTS.monthlyMax, Math.max(INVESTMENT_DEFAULTS.monthlyMin, v));
  const clampYears = (v: number) =>
    Math.min(INVESTMENT_DEFAULTS.yearsMax, Math.max(INVESTMENT_DEFAULTS.yearsMin, v));

  return (
    <div className="bg-white rounded-[20px] border-[1.5px] border-[#e2e8f0] shadow-[0_1px_3px_rgba(13,31,78,0.06),0_1px_2px_rgba(13,31,78,0.04)] p-5 sm:p-6 md:p-7">

      {/* Počáteční vklad */}
      <div className="mb-0">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Počáteční vklad</span>
          <div className="flex items-baseline gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(initial)}
              onChange={(e) => onInitialChange(clampInitial(parseCurrency(e.target.value)))}
              onFocus={(e) => e.target.select()}
              className="text-right font-bold text-[1.3rem] text-[#0d1f4e] bg-transparent border-none outline-none w-[170px] p-0.5 rounded hover:bg-[#f4f6fb] focus:bg-[#eff4ff] focus:text-[#2563eb] transition-colors"
            />
            <span className="text-xs font-semibold text-[#94a3b8]">Kč</span>
          </div>
        </div>
        <div className="px-2.5 pb-1">
          <input
            type="range"
            min={INVESTMENT_DEFAULTS.initialMin}
            max={INVESTMENT_DEFAULTS.initialMax}
            step={INVESTMENT_DEFAULTS.initialStep}
            value={initial}
            onChange={(e) => onInitialChange(clampInitial(parseInt(e.target.value, 10)))}
            className="mod-slider w-full"
            style={{ background: sliderGradient(initial, INVESTMENT_DEFAULTS.initialMin, INVESTMENT_DEFAULTS.initialMax) }}
          />
        </div>
        <div className="flex justify-between px-2.5 mt-0.5">
          <span className="text-[11px] text-[#94a3b8]">0 Kč</span>
          <span className="text-[11px] text-[#94a3b8]">2 mil. Kč</span>
        </div>
      </div>

      {/* Měsíční investice */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Měsíční investice</span>
          <div className="flex items-baseline gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(monthly)}
              onChange={(e) => onMonthlyChange(clampMonthly(parseCurrency(e.target.value)))}
              onFocus={(e) => e.target.select()}
              className="text-right font-bold text-[1.3rem] text-[#0d1f4e] bg-transparent border-none outline-none w-[170px] p-0.5 rounded hover:bg-[#f4f6fb] focus:bg-[#eff4ff] focus:text-[#2563eb] transition-colors"
            />
            <span className="text-xs font-semibold text-[#94a3b8]">Kč</span>
          </div>
        </div>
        <div className="px-2.5 pb-1">
          <input
            type="range"
            min={INVESTMENT_DEFAULTS.monthlyMin}
            max={INVESTMENT_DEFAULTS.monthlyMax}
            step={INVESTMENT_DEFAULTS.monthlyStep}
            value={monthly}
            onChange={(e) => onMonthlyChange(clampMonthly(parseInt(e.target.value, 10)))}
            className="mod-slider w-full"
            style={{ background: sliderGradient(monthly, INVESTMENT_DEFAULTS.monthlyMin, INVESTMENT_DEFAULTS.monthlyMax) }}
          />
        </div>
        <div className="flex justify-between px-2.5 mt-0.5">
          <span className="text-[11px] text-[#94a3b8]">500 Kč</span>
          <span className="text-[11px] text-[#94a3b8]">50 tis. Kč</span>
        </div>
      </div>

      {/* Doba investice */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Doba investice</span>
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-[1.2rem] text-[#0d1f4e]">{years}</span>
            <span className="text-xs font-semibold text-[#94a3b8]">let</span>
          </div>
        </div>
        <div className="px-2.5 pb-1">
          <input
            type="range"
            min={INVESTMENT_DEFAULTS.yearsMin}
            max={INVESTMENT_DEFAULTS.yearsMax}
            step={1}
            value={years}
            onChange={(e) => onYearsChange(clampYears(parseInt(e.target.value, 10)))}
            className="mod-slider w-full"
            style={{ background: sliderGradient(years, INVESTMENT_DEFAULTS.yearsMin, INVESTMENT_DEFAULTS.yearsMax) }}
          />
        </div>
        <div className="flex justify-between px-2.5 mt-0.5">
          <span className="text-[11px] text-[#94a3b8]">3 roky</span>
          <span className="text-[11px] text-[#94a3b8]">30 let</span>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="flex items-start gap-3 rounded-[10px] border border-blue-100 bg-[#eff4ff] p-3.5">
          <svg className="w-4 h-4 text-[#2563eb] mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-slate-600">
            <strong className="mb-0.5 block text-[#0d1f4e]">{profileTitle}</strong>
            <span>{profileDescription}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .mod-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 5px; border-radius: 3px; outline: none; cursor: pointer; }
        .mod-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 2.5px solid #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.13), 0 2px 7px rgba(37,99,235,0.28); cursor: grab; margin-top: -7px; transition: transform 0.14s ease, box-shadow 0.14s ease; }
        .mod-slider::-webkit-slider-thumb:hover { transform: scale(1.22); box-shadow: 0 0 0 5px rgba(37,99,235,0.15), 0 4px 12px rgba(37,99,235,0.38); }
        .mod-slider::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.08); }
        .mod-slider::-webkit-slider-runnable-track { height: 5px; border-radius: 3px; background: transparent; }
        .mod-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 2.5px solid #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.13); cursor: grab; }
        .mod-slider::-moz-range-track { height: 5px; border-radius: 3px; background: transparent; }
        .mod-slider::-moz-range-progress { background: linear-gradient(90deg, #2563eb, #38bdf8); border-radius: 3px; }
        .mod-slider:focus { outline: none; }
      `}</style>
    </div>
  );
}
