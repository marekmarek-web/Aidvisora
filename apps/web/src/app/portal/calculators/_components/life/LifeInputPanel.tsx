"use client";

import { LIMITS } from "@/lib/calculators/life/life.config";
import { formatCurrency } from "@/lib/calculators/life/formatters";
import type { LifeState } from "@/lib/calculators/life/life.types";
import { Info } from "lucide-react";

const INPUT_GROUPS: Array<{
  id: keyof Pick<LifeState, "age" | "netIncome" | "expenses" | "liabilities" | "reserves">;
  label: string;
  unit: string;
}> = [
  { id: "age", label: "Váš věk", unit: "let" },
  { id: "netIncome", label: "Čistý měsíční příjem", unit: "Kč" },
  { id: "expenses", label: "Nutné měsíční výdaje", unit: "Kč" },
  { id: "liabilities", label: "Hypotéka a závazky", unit: "Kč" },
  { id: "reserves", label: "Vlastní rezervy", unit: "Kč" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sliderGradient(value: number, min: number, max: number): string {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(90deg, #2563eb 0%, #38bdf8 ${pct}%, #cbd5e1 ${pct}%)`;
}

export interface LifeInputPanelProps {
  state: LifeState;
  onStateChange: (state: LifeState) => void;
}

export function LifeInputPanel({ state, onStateChange }: LifeInputPanelProps) {
  const update = (patch: Partial<LifeState>) => onStateChange({ ...state, ...patch });

  const handleRangeChange = (
    id: keyof Pick<LifeState, "age" | "netIncome" | "expenses" | "liabilities" | "reserves">,
    value: number,
  ) => {
    const lim = LIMITS[id];
    update({ [id]: clamp(value, lim.min, lim.max) });
  };

  const handleTextChange = (
    id: keyof Pick<LifeState, "age" | "netIncome" | "expenses" | "liabilities" | "reserves">,
    raw: string,
  ) => {
    const num = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
    const lim = LIMITS[id];
    update({ [id]: clamp(num, lim.min, lim.max) });
  };

  const expensesWarning = state.expenses > state.netIncome;

  const fmtMin = (id: string, lim: { min: number }, unit: string) =>
    id === "age" ? `${lim.min} ${unit}` : `${formatCurrency(lim.min)} ${unit}`;
  const fmtMax = (id: string, lim: { max: number }, unit: string) =>
    id === "age" ? `${lim.max} ${unit}` : `${formatCurrency(lim.max)} ${unit}`;

  return (
    <div className="bg-white rounded-[20px] border-[1.5px] border-[#e2e8f0] shadow-[0_1px_3px_rgba(13,31,78,0.06),0_1px_2px_rgba(13,31,78,0.04)] p-5 sm:p-6 md:p-7">

      {INPUT_GROUPS.map(({ id, label, unit }, idx) => {
        const lim = LIMITS[id];
        const value = state[id];
        const isWarning = id === "expenses" && expensesWarning;
        const isFirst = idx === 0;
        return (
          <div key={id} className={`${!isFirst ? "mt-6 pt-6 border-t border-[#e2e8f0]" : ""} ${isWarning ? "rounded-[10px] border-[1.5px] border-[rgba(234,88,12,0.2)] bg-[#fff7ed] p-3" : ""}`}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">{label}</span>
              <div className="flex items-baseline gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={id === "age" ? String(value) : formatCurrency(value)}
                  onChange={(e) => handleTextChange(id, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="text-right font-bold text-[1.3rem] text-[#0d1f4e] bg-transparent border-none outline-none w-[170px] p-0.5 rounded hover:bg-[#f4f6fb] focus:bg-[#eff4ff] focus:text-[#2563eb] transition-colors"
                />
                <span className="text-xs font-semibold text-[#94a3b8]">{unit}</span>
              </div>
            </div>
            <div className="px-2.5 pb-1">
              <input
                type="range"
                min={lim.min}
                max={lim.max}
                step={lim.step}
                value={value}
                onChange={(e) => handleRangeChange(id, Number(e.target.value))}
                className="mod-slider w-full"
                style={{ background: sliderGradient(value, lim.min, lim.max) }}
              />
            </div>
            <div className="flex justify-between px-2.5 mt-0.5">
              <span className="text-[11px] text-[#94a3b8]">{fmtMin(id, lim, unit)}</span>
              <span className="text-[11px] text-[#94a3b8]">{fmtMax(id, lim, unit)}</span>
            </div>
            {isWarning && (
              <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[#ea580c]">
                <Info className="h-4 w-4 shrink-0" />
                Pozor: Výdaje převyšují příjem.
              </div>
            )}
          </div>
        );
      })}

      {/* Rodina */}
      <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8] mb-2">Děti</span>
            <input
              type="number"
              min={LIMITS.children.min}
              max={LIMITS.children.max}
              value={state.children}
              onChange={(e) => update({ children: clamp(parseInt(e.target.value, 10) || 0, LIMITS.children.min, LIMITS.children.max) })}
              className="min-h-[44px] w-full rounded-[10px] border-[1.5px] border-[#cbd5e1] bg-white px-4 py-2 font-bold text-[#0d1f4e] outline-none focus:ring-2 focus:ring-[#2563eb]"
            />
          </div>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8] mb-2">Manžel/ka</span>
            <button
              type="button"
              onClick={() => update({ hasSpouse: !state.hasSpouse })}
              className={`min-h-[44px] w-full rounded-[10px] border-[1.5px] py-2 font-semibold transition-all ${
                state.hasSpouse
                  ? "bg-[#0d1f4e] border-[#0d1f4e] text-white"
                  : "bg-white border-[#cbd5e1] text-[#475569] hover:border-[#2563eb]"
              }`}
              aria-pressed={state.hasSpouse}
            >
              {state.hasSpouse ? "ANO" : "NE"}
            </button>
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
