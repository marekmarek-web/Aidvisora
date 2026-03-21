"use client";

import { LIMITS, DEFAULT_STATE } from "@/lib/calculators/life/life.config";
import { formatCurrency, parseCurrency } from "@/lib/calculators/life/formatters";
import type { LifeState } from "@/lib/calculators/life/life.types";
import { Users, Landmark, Info } from "lucide-react";

const INPUT_GROUPS: Array<{
  id: keyof Pick<LifeState, "age" | "netIncome" | "expenses" | "liabilities" | "reserves">;
  label: string;
  subLabel: string;
  unit: string;
}> = [
  { id: "age", label: "Váš věk", subLabel: "(let)", unit: "let" },
  { id: "netIncome", label: "Čistý měsíční příjem", subLabel: "(Kč)", unit: "Kč" },
  { id: "expenses", label: "Nutné měsíční výdaje", subLabel: "(Kč)", unit: "Kč" },
  { id: "liabilities", label: "Hypotéka a závazky", subLabel: "(celkem)", unit: "Kč" },
  { id: "reserves", label: "Vlastní rezervy", subLabel: "(investice, hotovost)", unit: "Kč" },
];

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(max, Math.max(min, value));
}

export interface LifeInputPanelProps {
  state: LifeState;
  onStateChange: (state: LifeState) => void;
}

export function LifeInputPanel({ state, onStateChange }: LifeInputPanelProps) {
  const update = (patch: Partial<LifeState>) => {
    onStateChange({ ...state, ...patch });
  };

  const handleRangeChange = (
    id: keyof Pick<LifeState, "age" | "netIncome" | "expenses" | "liabilities" | "reserves">,
    value: number
  ) => {
    const lim = LIMITS[id];
    value = clamp(value, lim.min, lim.max);
    update({ [id]: value });
  };

  const handleTextChange = (
    id: keyof Pick<LifeState, "age" | "netIncome" | "expenses" | "liabilities" | "reserves">,
    raw: string
  ) => {
    const num = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
    const lim = LIMITS[id];
    const value = clamp(num, lim.min, lim.max);
    update({ [id]: value });
  };

  const handleChildrenChange = (value: number) => {
    update({
      children: clamp(value, LIMITS.children.min, LIMITS.children.max),
    });
  };

  const handleSpouseToggle = () => {
    update({ hasSpouse: !state.hasSpouse });
  };

  const expensesWarning = state.expenses > state.netIncome;
  const sliderBackground = (id: keyof typeof LIMITS, value: number) => {
    const lim = LIMITS[id];
    const ratio = ((value - lim.min) / (lim.max - lim.min)) * 100;
    return `linear-gradient(90deg, #4f46e5 ${ratio}%, #e2e8f0 ${ratio}%)`;
  };

  return (
    <div className="space-y-5 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 md:p-7">
      <section className="space-y-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          <Users className="h-4 w-4 text-indigo-500" />
          Vaše údaje
        </h3>

        {INPUT_GROUPS.map(({ id, label, subLabel, unit }) => {
          const lim = LIMITS[id];
          const value = state[id];
          const isWarning = id === "expenses" && expensesWarning;
          return (
            <div
              key={id}
              className={`space-y-3 ${isWarning ? "rounded-xl border border-red-100 bg-red-50 p-3" : ""}`}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label
                  htmlFor={`${id}-range`}
                  className="text-sm font-semibold text-slate-600"
                >
                  <span className="uppercase tracking-wide">{label}</span>{" "}
                  <span className="font-normal text-slate-400">{subLabel}</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCurrency(value)}
                  onChange={(e) => handleTextChange(id, e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-right text-2xl font-extrabold text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-400 sm:w-56"
                />
              </div>
              <input
                type="range"
                id={`${id}-range`}
                min={lim.min}
                max={lim.max}
                step={lim.step}
                value={value}
                onChange={(e) => handleRangeChange(id, Number(e.target.value))}
                className="life-slider min-h-[44px] w-full touch-manipulation"
                style={{ background: sliderBackground(id, value) }}
              />
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>
                  {id === "age" ? lim.min : formatCurrency(lim.min)} {unit}
                </span>
                <span>
                  {id === "age" ? lim.max : formatCurrency(lim.max)} {unit}
                </span>
              </div>
              {isWarning && (
                <div className="mt-1 flex items-center gap-2 text-xs font-bold text-red-600">
                  <Info className="h-4 w-4 shrink-0" />
                  Pozor: Výdaje převyšují příjem. Pojištění bude kalkulováno z
                  výdajů.
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <h3 className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          <Landmark className="h-4 w-4 text-indigo-500" />
          Majetek a rodina
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="input-children"
              className="mb-2 block text-sm font-bold uppercase tracking-wide text-slate-600"
            >
              Děti
            </label>
            <input
              type="number"
              id="input-children"
              min={LIMITS.children.min}
              max={LIMITS.children.max}
              value={state.children}
              onChange={(e) =>
                handleChildrenChange(parseInt(e.target.value, 10) || 0)
              }
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-slate-600">
              Manžel/ka
            </label>
            <button
              type="button"
              onClick={handleSpouseToggle}
              className={`min-h-[48px] w-full rounded-xl border-2 py-3.5 font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                state.hasSpouse
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              }`}
              aria-pressed={state.hasSpouse}
            >
              {state.hasSpouse ? "ANO" : "NE"}
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        .life-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 8px;
          border-radius: 9999px;
          cursor: pointer;
        }
        .life-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 9999px;
          background: transparent;
        }
        .life-slider::-moz-range-track {
          height: 8px;
          border-radius: 9999px;
          background: transparent;
        }
        .life-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          margin-top: -6px;
          border-radius: 9999px;
          border: 3px solid #fff;
          background: #4f46e5;
          box-shadow: 0 4px 10px rgba(79, 70, 229, 0.35);
        }
        .life-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border: 3px solid #fff;
          border-radius: 9999px;
          background: #4f46e5;
          box-shadow: 0 4px 10px rgba(79, 70, 229, 0.35);
        }
        .life-slider:focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: 4px;
        }
      `}</style>
    </div>
  );
}
