"use client";

import type { TabType } from "@/lib/calculators/mortgage";

export interface MortgageTabSwitcherProps {
  type: TabType;
  onTypeChange: (type: TabType) => void;
}

export function MortgageTabSwitcher({ type, onTypeChange }: MortgageTabSwitcherProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onTypeChange("new")}
        className={`min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
          type === "new"
            ? "bg-[#fbbf24] text-[#0a0f29] shadow-lg"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        Nová hypotéka
      </button>
      <button
        type="button"
        onClick={() => onTypeChange("refi")}
        className={`min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
          type === "refi"
            ? "bg-[#fbbf24] text-[#0a0f29] shadow-lg"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        Refinancování
      </button>
    </div>
  );
}
