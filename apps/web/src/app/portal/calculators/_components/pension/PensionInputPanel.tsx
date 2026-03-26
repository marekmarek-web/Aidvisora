"use client";

import { LIMITS, SCENARIO_OPTIONS } from "@/lib/calculators/pension/pension.config";
import { formatCurrency, parseCurrency } from "@/lib/calculators/pension/formatters";
import type { PensionState } from "@/lib/calculators/pension/pension.types";
import { Info } from "lucide-react";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { PiggyBank } from "lucide-react";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sliderGradient(value: number, min: number, max: number): string {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(90deg, #2563eb 0%, #38bdf8 ${pct}%, #cbd5e1 ${pct}%)`;
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
    value: number,
  ) => {
    const lim = LIMITS[key];
    update({ [key]: clamp(value, lim.min, lim.max) });
  };

  const handleTextChange = (
    key: keyof Pick<PensionState, "salary" | "rent">,
    raw: string,
  ) => {
    const num = parseCurrency(raw);
    const lim = LIMITS[key];
    update({ [key]: clamp(num, lim.min, lim.max) });
  };

  return (
    <div className="bg-[color:var(--wp-surface-card)] rounded-[20px] border-[1.5px] border-[#e2e8f0] shadow-[0_1px_3px_rgba(13,31,78,0.06),0_1px_2px_rgba(13,31,78,0.04)] p-5 sm:p-6 md:p-7">

      {/* Věk */}
      <div className="mb-0">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Váš věk</span>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={LIMITS.age.min}
              max={LIMITS.age.max}
              value={state.age}
              onChange={(e) => handleRangeChange("age", parseInt(e.target.value, 10) || LIMITS.age.min)}
              onFocus={(e) => e.target.select()}
              className="text-right font-bold text-[1.3rem] text-[#0d1f4e] bg-transparent border-none outline-none w-[80px] p-0.5 rounded hover:bg-[#f4f6fb] focus:bg-[#eff4ff] focus:text-[#2563eb] transition-colors"
            />
            <span className="text-xs font-semibold text-[#94a3b8]">let</span>
          </div>
        </div>
        <div className="px-2.5 pb-1">
          <input
            type="range"
            min={LIMITS.age.min}
            max={LIMITS.age.max}
            step={LIMITS.age.step}
            value={state.age}
            onChange={(e) => handleRangeChange("age", Number(e.target.value))}
            className="mod-slider w-full"
            style={{ background: sliderGradient(state.age, LIMITS.age.min, LIMITS.age.max) }}
          />
        </div>
        <div className="flex justify-between px-2.5 mt-0.5">
          <span className="text-[11px] text-[#94a3b8]">{LIMITS.age.min} let</span>
          <span className="text-[11px] text-[#94a3b8]">{LIMITS.age.max} let</span>
        </div>
      </div>

      {/* Věk odchodu */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Věk odchodu do důchodu</span>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={LIMITS.retireAge.min}
              max={LIMITS.retireAge.max}
              value={state.retireAge}
              onChange={(e) => handleRangeChange("retireAge", parseInt(e.target.value, 10) || LIMITS.retireAge.min)}
              onFocus={(e) => e.target.select()}
              className="text-right font-bold text-[1.3rem] text-[#0d1f4e] bg-transparent border-none outline-none w-[80px] p-0.5 rounded hover:bg-[#f4f6fb] focus:bg-[#eff4ff] focus:text-[#2563eb] transition-colors"
            />
            <span className="text-xs font-semibold text-[#94a3b8]">let</span>
          </div>
        </div>
        <div className="px-2.5 pb-1">
          <input
            type="range"
            min={LIMITS.retireAge.min}
            max={LIMITS.retireAge.max}
            step={LIMITS.retireAge.step}
            value={state.retireAge}
            onChange={(e) => handleRangeChange("retireAge", Number(e.target.value))}
            className="mod-slider w-full"
            style={{ background: sliderGradient(state.retireAge, LIMITS.retireAge.min, LIMITS.retireAge.max) }}
          />
        </div>
        <div className="flex justify-between px-2.5 mt-0.5">
          <span className="text-[11px] text-[#94a3b8]">{LIMITS.retireAge.min} let</span>
          <span className="text-[11px] text-[#94a3b8]">{LIMITS.retireAge.max} let</span>
        </div>
      </div>

      {/* Hrubá mzda */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">Hrubá mzda měsíčně</span>
          <div className="flex items-baseline gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={formatCurrency(state.salary)}
              onChange={(e) => handleTextChange("salary", e.target.value)}
              onFocus={(e) => e.target.select()}
              className="text-right font-bold text-[1.3rem] text-[#0d1f4e] bg-transparent border-none outline-none w-[170px] p-0.5 rounded hover:bg-[#f4f6fb] focus:bg-[#eff4ff] focus:text-[#2563eb] transition-colors"
            />
            <span className="text-xs font-semibold text-[#94a3b8]">Kč</span>
          </div>
        </div>
        <div className="px-2.5 pb-1">
          <input
            type="range"
            min={LIMITS.salary.min}
            max={LIMITS.salary.max}
            step={LIMITS.salary.step}
            value={state.salary}
            onChange={(e) => handleRangeChange("salary", Number(e.target.value))}
            className="mod-slider w-full"
            style={{ background: sliderGradient(state.salary, LIMITS.salary.min, LIMITS.salary.max) }}
          />
        </div>
        <div className="flex justify-between px-2.5 mt-0.5">
          <span className="text-[11px] text-[#94a3b8]">{formatCurrency(LIMITS.salary.min)} Kč</span>
          <span className="text-[11px] text-[#94a3b8]">{formatCurrency(LIMITS.salary.max)} Kč</span>
        </div>
      </div>

      {/* Cílová renta */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="rounded-[10px] border border-blue-100 bg-[#eff4ff] p-3.5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#2563eb]">Cílová renta v důchodu</span>
            <div className="flex items-baseline gap-1">
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrency(state.rent)}
                onChange={(e) => handleTextChange("rent", e.target.value)}
                onFocus={(e) => e.target.select()}
                className="text-right font-bold text-[1.3rem] text-[#0d1f4e] bg-transparent border-none outline-none w-[170px] p-0.5 rounded hover:bg-[color:var(--wp-surface-card)] focus:bg-[color:var(--wp-surface-card)] focus:text-[#2563eb] transition-colors"
              />
              <span className="text-xs font-semibold text-[#94a3b8]">Kč</span>
            </div>
          </div>
          <div className="px-2.5 pb-1">
            <input
              type="range"
              min={LIMITS.rent.min}
              max={LIMITS.rent.max}
              step={LIMITS.rent.step}
              value={state.rent}
              onChange={(e) => handleRangeChange("rent", Number(e.target.value))}
              className="mod-slider w-full"
              style={{ background: sliderGradient(state.rent, LIMITS.rent.min, LIMITS.rent.max) }}
            />
          </div>
          <div className="flex justify-between px-2.5 mt-0.5">
            <span className="text-[11px] text-[#94a3b8]">{formatCurrency(LIMITS.rent.min)} Kč</span>
            <span className="text-[11px] text-[#94a3b8]">{formatCurrency(LIMITS.rent.max)} Kč</span>
          </div>
        </div>
      </div>

      {/* Scénář + odhad */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8] mb-2">Scénář důchodu</span>
            <CustomDropdown
              value={state.scenario}
              onChange={(id) => update({ scenario: id as PensionState["scenario"] })}
              options={SCENARIO_OPTIONS.map((opt) => ({ id: opt.value, label: opt.label }))}
              placeholder="Scénář"
              icon={PiggyBank}
            />
          </div>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8] mb-2">Odhad státního důchodu</span>
            <input
              type="text"
              readOnly
              value={`${formatCurrency(estimatedPension)} Kč`}
              className="min-h-[44px] w-full cursor-not-allowed rounded-[10px] border-[1.5px] border-[#cbd5e1] bg-[#f4f6fb] px-4 py-2 font-bold text-[#0d1f4e]"
            />
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="flex items-start gap-3 rounded-[10px] border border-[color:var(--wp-surface-card-border)] bg-[#f4f6fb] p-3.5">
          <Info className="w-4 h-4 text-[#2563eb] mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold text-[#0d1f4e] mb-0.5">Proč mi vychází tak málo?</div>
            <p className="text-xs text-[#475569] leading-relaxed">
              Demografická realita: méně pracujících na jednoho důchodce a vyšší
              průměrný věk znamenají tlak na výši státních důchodů.
            </p>
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
