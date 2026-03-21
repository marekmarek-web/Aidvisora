"use client";

import type { ProductType } from "@/lib/calculators/mortgage";

export interface MortgageProductSwitcherProps {
  product: ProductType;
  onProductChange: (product: ProductType) => void;
}

export function MortgageProductSwitcher({
  product,
  onProductChange,
}: MortgageProductSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
      <button
        type="button"
        onClick={() => onProductChange("mortgage")}
        className={`min-h-[44px] min-w-[44px] px-5 sm:px-6 py-2.5 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all touch-manipulation ${
          product === "mortgage"
            ? "bg-slate-900 text-white shadow-sm"
            : "bg-transparent text-slate-600 hover:bg-white"
        }`}
      >
        Hypotéka
      </button>
      <button
        type="button"
        onClick={() => onProductChange("loan")}
        className={`min-h-[44px] min-w-[44px] px-5 sm:px-6 py-2.5 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all touch-manipulation ${
          product === "loan"
            ? "bg-slate-900 text-white shadow-sm"
            : "bg-transparent text-slate-600 hover:bg-white"
        }`}
      >
        Úvěry
      </button>
    </div>
  );
}
