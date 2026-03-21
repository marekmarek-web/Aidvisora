"use client";

import type { TabType } from "@/lib/calculators/mortgage";
import type { ProductType } from "@/lib/calculators/mortgage";

export interface MortgageTabSwitcherProps {
  product: ProductType;
  type: TabType;
  onTypeChange: (type: TabType) => void;
}

export function MortgageTabSwitcher({
  product,
  type,
  onTypeChange,
}: MortgageTabSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
      <button
        type="button"
        onClick={() => onTypeChange("new")}
        className={`min-h-[44px] min-w-[44px] px-4 sm:px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all touch-manipulation ${
          type === "new"
            ? "bg-white text-slate-900 shadow-sm"
            : "bg-transparent text-slate-600 hover:bg-white"
        }`}
      >
        {product === "loan" ? "Nový úvěr" : "Nová hypotéka"}
      </button>
      <button
        type="button"
        onClick={() => onTypeChange("refi")}
        className={`min-h-[44px] min-w-[44px] px-4 sm:px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all touch-manipulation ${
          type === "refi"
            ? "bg-white text-slate-900 shadow-sm"
            : "bg-transparent text-slate-600 hover:bg-white"
        }`}
      >
        Refinancování
      </button>
    </div>
  );
}
