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

  const getSliderBackground = (value: number, min: number, max: number) => {
    const ratio = ((value - min) / (max - min)) * 100;
    return `linear-gradient(90deg, #2563eb 0%, #38bdf8 ${ratio}%, #cbd5e1 ${ratio}%)`;
  };

  return (
    <div className="overflow-hidden rounded-[20px] border-[1.5px] border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:p-7">
      <div className="space-y-6 rounded-[14px] border border-slate-100 bg-white p-4 sm:p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="text-sm font-semibold text-slate-600 leading-tight">
              <span className="uppercase tracking-[0.06em] text-xs text-slate-400">Počáteční vklad</span>{" "}
              <span className="font-normal text-slate-400">(v Kč)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(initial)}
              onChange={(e) =>
                onInitialChange(clampInitial(parseCurrency(e.target.value)))
              }
              className="min-h-[44px] w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-4 py-2 text-right font-extrabold text-xl sm:text-2xl text-[#0d1f4e] outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-56"
              aria-label="Počáteční vklad"
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
            className="investment-slider w-full min-h-[44px] touch-manipulation"
            style={{
              background: getSliderBackground(
                initial,
                INVESTMENT_DEFAULTS.initialMin,
                INVESTMENT_DEFAULTS.initialMax,
              ),
            }}
            aria-label="Slider počátečního vkladu"
          />
          <div className="flex justify-between text-xs font-semibold text-slate-400">
            <span>0 Kč</span>
            <span>2 mil.</span>
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="text-sm font-semibold text-slate-600 leading-tight">
              <span className="uppercase tracking-[0.06em] text-xs text-slate-400">Měsíční investice</span>{" "}
              <span className="font-normal text-slate-400">(v Kč)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(monthly)}
              onChange={(e) =>
                onMonthlyChange(clampMonthly(parseCurrency(e.target.value)))
              }
              className="min-h-[44px] w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-4 py-2 text-right font-extrabold text-xl sm:text-2xl text-[#0d1f4e] outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-56"
              aria-label="Měsíční investice"
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
            className="investment-slider w-full min-h-[44px] touch-manipulation"
            style={{
              background: getSliderBackground(
                monthly,
                INVESTMENT_DEFAULTS.monthlyMin,
                INVESTMENT_DEFAULTS.monthlyMax,
              ),
            }}
            aria-label="Slider měsíční investice"
          />
          <div className="flex justify-between text-xs font-semibold text-slate-400">
            <span>500 Kč</span>
            <span>50 tis.</span>
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">
            Doba investice
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={INVESTMENT_DEFAULTS.yearsMin}
              max={INVESTMENT_DEFAULTS.yearsMax}
              step={1}
              value={years}
              onChange={(e) =>
                onYearsChange(clampYears(parseInt(e.target.value, 10)))}
              className="investment-slider min-h-[44px] flex-1 touch-manipulation"
              style={{
                background: getSliderBackground(
                  years,
                  INVESTMENT_DEFAULTS.yearsMin,
                  INVESTMENT_DEFAULTS.yearsMax,
                ),
              }}
              aria-label="Slider doby investice"
            />
            <div className="min-w-[92px] rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3 py-2 text-center text-sm sm:text-base font-bold text-[#0d1f4e]">
              {years} let
            </div>
          </div>
          <div className="flex justify-between text-xs font-semibold text-slate-400">
            <span>3 roky</span>
            <span>30 let</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-[10px] border border-blue-100 bg-blue-50/70 p-4">
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
          <strong className="mb-1 block text-slate-900">{profileTitle}</strong>
          <span>{profileDescription}</span>
        </div>
      </div>

      <style jsx>{`
        .investment-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 5px;
          border-radius: 999px;
          cursor: pointer;
        }
        .investment-slider::-webkit-slider-runnable-track {
          height: 5px;
          border-radius: 999px;
          background: transparent;
        }
        .investment-slider::-moz-range-track {
          height: 5px;
          border-radius: 999px;
          background: transparent;
        }
        .investment-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          margin-top: -7px;
          border-radius: 999px;
          border: 2.5px solid #2563eb;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.13), 0 2px 7px rgba(37, 99, 235, 0.28);
        }
        .investment-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border: 2.5px solid #2563eb;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.13);
        }
        .investment-slider:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 4px;
        }
      `}</style>
    </div>
  );
}
