"use client";

import { LIMITS, DEFAULT_STATE, SCENARIO_OPTIONS } from "@/lib/calculators/pension/pension.config";
import { formatCurrency, parseCurrency } from "@/lib/calculators/pension/formatters";
import type { PensionState } from "@/lib/calculators/pension/pension.types";
import { PiggyBank, Info } from "lucide-react";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface PensionInputPanelProps {
  state: PensionState;
  onStateChange: (state: PensionState) => void;
  estimatedPension: number;
}

export function PensionInputPanel({
  state,
  onStateChange,
  estimatedPension,
}: PensionInputPanelProps) {
  const update = (patch: Partial<PensionState>) => {
    let next = { ...state, ...patch };
    if (patch.age !== undefined && next.age >= next.retireAge) {
      next.retireAge = Math.min(LIMITS.retireAge.max, next.age + 1);
    }
    if (patch.retireAge !== undefined && next.age >= next.retireAge) {
      next.retireAge = Math.min(LIMITS.retireAge.max, next.age + 1);
    }
    onStateChange(next);
  };

  const handleRangeChange = (
    key: keyof Pick<PensionState, "age" | "retireAge" | "salary" | "rent">,
    value: number
  ) => {
    const lim = LIMITS[key];
    value = clamp(value, lim.min, lim.max);
    update({ [key]: value });
  };

  const handleTextChange = (
    key: keyof Pick<PensionState, "salary" | "rent">,
    raw: string
  ) => {
    const num = parseCurrency(raw);
    const lim = LIMITS[key];
    const value = clamp(num, lim.min, lim.max);
    update({ [key]: value });
  };

  const sliderBackground = (
    key: keyof Pick<PensionState, "age" | "retireAge" | "salary" | "rent">,
    value: number,
  ) => {
    const lim = LIMITS[key];
    const ratio = ((value - lim.min) / (lim.max - lim.min)) * 100;
    return `linear-gradient(90deg, #2563eb 0%, #38bdf8 ${ratio}%, #cbd5e1 ${ratio}%)`;
  };

  return (
    <div className="space-y-5 rounded-[20px] border-[1.5px] border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:p-7">
      <section className="space-y-6 rounded-[14px] border border-slate-100 bg-white p-4 sm:p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-400">
          <PiggyBank className="h-4 w-4 text-indigo-500" />
          Vaše údaje
        </h3>

        <div className="space-y-6">
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label htmlFor="age-range" className="text-sm font-semibold text-slate-600 leading-tight">
              <span className="uppercase tracking-[0.06em] text-xs text-slate-400">Váš věk</span>{" "}
              <span className="font-normal text-slate-400">(let)</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={LIMITS.age.min}
              max={LIMITS.age.max}
              value={state.age}
              onChange={(e) =>
                handleRangeChange("age", parseInt(e.target.value, 10) || LIMITS.age.min)
              }
              className="min-h-[44px] w-24 rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3 py-2 text-right text-xl sm:text-2xl font-extrabold text-[#0d1f4e] outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
          <input
            type="range"
            id="age-range"
            min={LIMITS.age.min}
            max={LIMITS.age.max}
            step={LIMITS.age.step}
            value={state.age}
            onChange={(e) => handleRangeChange("age", Number(e.target.value))}
            className="pension-slider min-h-[44px] w-full touch-manipulation"
            style={{ background: sliderBackground("age", state.age) }}
          />
          <div className="mt-3 flex justify-between text-xs font-semibold text-slate-400">
            <span>{LIMITS.age.min} let</span>
            <span>{LIMITS.age.max} let</span>
          </div>
        </div>

        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label htmlFor="retireAge-range" className="text-sm font-semibold text-slate-600 leading-tight">
              <span className="uppercase tracking-[0.06em] text-xs text-slate-400">Věk odchodu do důchodu</span>{" "}
              <span className="font-normal text-slate-400">(let)</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={LIMITS.retireAge.min}
              max={LIMITS.retireAge.max}
              value={state.retireAge}
              onChange={(e) =>
                handleRangeChange(
                  "retireAge",
                  parseInt(e.target.value, 10) || LIMITS.retireAge.min
                )
              }
              className="min-h-[44px] w-24 rounded-[10px] border-[1.5px] border-slate-300 bg-white px-3 py-2 text-right text-xl sm:text-2xl font-extrabold text-[#0d1f4e] outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
          <input
            type="range"
            id="retireAge-range"
            min={LIMITS.retireAge.min}
            max={LIMITS.retireAge.max}
            step={LIMITS.retireAge.step}
            value={state.retireAge}
            onChange={(e) => handleRangeChange("retireAge", Number(e.target.value))}
            className="pension-slider min-h-[44px] w-full touch-manipulation"
            style={{ background: sliderBackground("retireAge", state.retireAge) }}
          />
          <div className="mt-3 flex justify-between text-xs font-semibold text-slate-400">
            <span>{LIMITS.retireAge.min} let</span>
            <span>{LIMITS.retireAge.max} let</span>
          </div>
        </div>

        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label htmlFor="salary-range" className="text-sm font-semibold text-slate-600 leading-tight">
              <span className="uppercase tracking-[0.06em] text-xs text-slate-400">Hrubá mzda měsíčně</span>{" "}
              <span className="font-normal text-slate-400">(Kč)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(state.salary)}
              onChange={(e) => handleTextChange("salary", e.target.value)}
              className="min-h-[44px] w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-4 py-2 text-right text-xl sm:text-2xl font-extrabold text-[#0d1f4e] outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-56"
            />
          </div>
          <input
            type="range"
            id="salary-range"
            min={LIMITS.salary.min}
            max={LIMITS.salary.max}
            step={LIMITS.salary.step}
            value={state.salary}
            onChange={(e) => handleRangeChange("salary", Number(e.target.value))}
            className="pension-slider min-h-[44px] w-full touch-manipulation"
            style={{ background: sliderBackground("salary", state.salary) }}
          />
          <div className="mt-3 flex justify-between text-xs font-semibold text-slate-400">
            <span>{formatCurrency(LIMITS.salary.min)} Kč</span>
            <span>{formatCurrency(LIMITS.salary.max)} Kč</span>
          </div>
        </div>

        <div className="rounded-[10px] border border-blue-100 bg-blue-50/70 p-3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label htmlFor="rent-range" className="text-sm font-semibold text-slate-600 leading-tight">
              <span className="uppercase tracking-[0.06em] text-xs text-slate-400">Cílová renta v důchodu (dnes)</span>{" "}
              <span className="font-normal text-slate-400">(Kč)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(state.rent)}
              onChange={(e) => handleTextChange("rent", e.target.value)}
              className="min-h-[44px] w-full rounded-[10px] border-[1.5px] border-slate-300 bg-white px-4 py-2 text-right text-xl sm:text-2xl font-extrabold text-[#0d1f4e] outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-56"
            />
          </div>
          <input
            type="range"
            id="rent-range"
            min={LIMITS.rent.min}
            max={LIMITS.rent.max}
            step={LIMITS.rent.step}
            value={state.rent}
            onChange={(e) => handleRangeChange("rent", Number(e.target.value))}
            className="pension-slider min-h-[44px] w-full touch-manipulation"
            style={{ background: sliderBackground("rent", state.rent) }}
          />
          <div className="mt-3 flex justify-between text-xs font-semibold text-slate-400">
            <span>{formatCurrency(LIMITS.rent.min)} Kč</span>
            <span>{formatCurrency(LIMITS.rent.max)} Kč</span>
          </div>
        </div>
        </div>
      </section>

      <section className="space-y-5 rounded-[14px] border border-slate-100 bg-white p-4 sm:p-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.06em] text-slate-400">
            Scénář odhadu státního důchodu
          </label>
          <CustomDropdown
            value={state.scenario}
            onChange={(id) =>
              update({ scenario: id as PensionState["scenario"] })
            }
            options={SCENARIO_OPTIONS.map((opt) => ({ id: opt.value, label: opt.label }))}
            placeholder="Scénář"
            icon={PiggyBank}
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.06em] text-slate-400">
            Odhad státního důchodu
          </label>
          <input
            type="text"
            readOnly
            value={`${formatCurrency(estimatedPension)} Kč`}
            className="min-h-[48px] w-full cursor-not-allowed rounded-[10px] border-[1.5px] border-slate-300 bg-slate-50 px-4 py-3.5 font-bold text-[#0d1f4e]"
          />
        </div>
      </section>

      <div className="rounded-[10px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-slate-900 mb-1">
              Proč mi vychází tak málo?
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Demografická realita: méně pracujících na jednoho důchodce a vyšší
              průměrný věk znamenají tlak na výši státních důchodů. Odhad vychází
              z náhradových poměrů a scénáře vývoje; reálná výše může být nižší.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pension-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 5px;
          border-radius: 999px;
          cursor: pointer;
        }
        .pension-slider::-webkit-slider-runnable-track {
          height: 5px;
          border-radius: 999px;
          background: transparent;
        }
        .pension-slider::-moz-range-track {
          height: 5px;
          border-radius: 999px;
          background: transparent;
        }
        .pension-slider::-webkit-slider-thumb {
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
        .pension-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border: 2.5px solid #2563eb;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.13);
        }
        .pension-slider:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 4px;
        }
      `}</style>
    </div>
  );
}
