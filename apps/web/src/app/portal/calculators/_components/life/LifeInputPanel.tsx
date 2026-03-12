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

  return (
    <div className="bg-white rounded-2xl p-5 md:p-10 shadow-sm border border-[#D6E6FF]/60">
      <h3 className="text-slate-500 font-bold uppercase tracking-wider text-sm mb-8 flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-500" />
        Vaše údaje
      </h3>

      {INPUT_GROUPS.map(({ id, label, subLabel, unit }) => {
        const lim = LIMITS[id];
        const value = state[id];
        const isWarning = id === "expenses" && expensesWarning;
        return (
          <div
            key={id}
            className={`mb-10 ${id === "reserves" && value > 0 ? "mb-0" : ""} ${isWarning ? "p-4 bg-red-50 rounded-xl border border-red-100" : ""}`}
          >
            <div className="flex justify-between items-end mb-4">
              <label
                htmlFor={`${id}-range`}
                className="text-sm font-bold text-slate-600 tracking-wide"
              >
                <span className="uppercase">{label}</span>{" "}
                <span className="text-slate-400 font-normal normal-case">
                  {subLabel}
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrency(value)}
                onChange={(e) => handleTextChange(id, e.target.value)}
                className="text-right font-extrabold text-2xl md:text-3xl text-slate-900 border-b-2 border-slate-200 focus:border-indigo-500 outline-none w-48 md:w-56 bg-transparent transition-colors p-1 min-w-0"
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
              className="w-full min-h-[28px] touch-manipulation"
            />
            <div className="flex justify-between text-xs font-medium text-slate-400 mt-3">
              <span>
                {id === "age" ? lim.min : formatCurrency(lim.min)} {unit}
              </span>
              <span>
                {id === "age" ? lim.max : formatCurrency(lim.max)} {unit}
              </span>
            </div>
            {isWarning && (
              <div className="text-xs text-red-600 font-bold mt-2 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                Pozor: Výdaje převyšují příjem. Pojištění bude kalkulováno z
                výdajů.
              </div>
            )}
          </div>
        );
      })}

      <div className="h-px bg-slate-100 my-8" />

      <h3 className="text-slate-500 font-bold uppercase tracking-wider text-sm mb-8 flex items-center gap-2">
        <Landmark className="w-4 h-4 text-indigo-500" />
        Majetek a Rodina
      </h3>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="input-children"
            className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide"
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
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold py-3.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[48px]"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wide">
            Manžel/ka
          </label>
          <button
            type="button"
            onClick={handleSpouseToggle}
            className={`w-full py-3.5 rounded-xl font-bold border-2 transition-all min-h-[48px] ${
              state.hasSpouse
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-200 text-slate-400 bg-slate-50"
            }`}
          >
            {state.hasSpouse ? "ANO" : "NE"}
          </button>
        </div>
      </div>
    </div>
  );
}
