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
        className={`min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
          product === "mortgage"
            ? "bg-[#fbbf24] text-[#0a0f29] shadow-lg"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        Hypotéka
      </button>
      <button
        type="button"
        onClick={() => onProductChange("loan")}
        className={`min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
          product === "loan"
            ? "bg-[#fbbf24] text-[#0a0f29] shadow-lg"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        Úvěry
      </button>
    </div>
  );
}
