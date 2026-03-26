"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/calculators/core/types";

export interface CalculatorFaqSectionProps {
  title: string;
  items: FaqItem[];
}

export function CalculatorFaqSection({ title, items }: CalculatorFaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-12">
      <h2 className="text-3xl font-bold text-[#0a0f29] mb-8 text-center uppercase tracking-widest">
        {title}
      </h2>
      <div className="space-y-4 max-w-4xl mx-auto">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="rounded-xl shadow-sm mb-4 border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] transition-shadow hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full text-left py-4 px-6 flex justify-between items-center transition-colors hover:text-[#fbbf24] focus:outline-none min-h-[44px] touch-manipulation"
              >
                <h4 className="text-lg font-bold text-[color:var(--wp-text)] pr-4">{item.question}</h4>
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
                  <p className="text-[color:var(--wp-text-secondary)] text-sm">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
