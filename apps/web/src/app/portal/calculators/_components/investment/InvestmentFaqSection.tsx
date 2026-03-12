"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/calculators/investment/investment.config";
import { ChevronDown } from "lucide-react";

export interface InvestmentFaqSectionProps {
  items: FaqItem[];
}

export function InvestmentFaqSection({ items }: InvestmentFaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-12">
      <h2 className="text-3xl font-bold text-[#0a0f29] mb-8 text-center uppercase tracking-widest">
        FAQ – Investiční kalkulačka
      </h2>
      <div className="space-y-4 max-w-4xl mx-auto">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="rounded-xl shadow-sm mb-4 border border-slate-100 bg-white transition-shadow hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full text-left py-4 px-6 flex justify-between items-center transition-colors hover:text-[#fbbf24] focus:outline-none min-h-[44px] touch-manipulation"
              >
                <h4 className="text-lg font-bold text-slate-900 pr-4">{item.question}</h4>
                <ChevronDown
                  className={`w-5 h-5 shrink-0 transition-transform text-[#0B3A7A] ${isOpen ? "rotate-180 text-[#fbbf24]" : ""}`}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: isOpen ? 800 : 0,
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <div className="pb-4 px-6">
                  <p className="text-slate-600 text-sm">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
