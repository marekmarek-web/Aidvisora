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
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onProductChange("mortgage")}
        className={`min-h-[44px] min-w-[44px] px-5 sm:px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all touch-manipulation ${
          product === "mortgage"
            ? "bg-indigo-600 text-white shadow-md"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Hypotéka
      </button>
      <button
        type="button"
        onClick={() => onProductChange("loan")}
        className={`min-h-[44px] min-w-[44px] px-5 sm:px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all touch-manipulation ${
          product === "loan"
            ? "bg-indigo-600 text-white shadow-md"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        Úvěry
      </button>
    </div>
  );
}
