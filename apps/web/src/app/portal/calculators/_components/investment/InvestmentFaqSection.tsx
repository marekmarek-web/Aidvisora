"use client";

import { CalculatorFaqSection } from "../core/CalculatorFaqSection";
import type { FaqItem } from "@/lib/calculators/investment/investment.config";

export interface InvestmentFaqSectionProps {
  items: FaqItem[];
}

const FAQ_TITLE = "FAQ – Investiční kalkulačka";

export function InvestmentFaqSection({ items }: InvestmentFaqSectionProps) {
  return (
    <CalculatorFaqSection
      title={FAQ_TITLE}
      items={items}
    />
  );
}
