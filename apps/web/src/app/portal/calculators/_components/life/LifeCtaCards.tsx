"use client";

import Link from "next/link";
import { TrendingUp, PiggyBank, HeartPulse } from "lucide-react";

const CALC_CARDS = [
  {
    href: "/portal/calculators/investment",
    icon: TrendingUp,
    title: "Investiční kalkulačka",
    description: "Zhodnocování úspor a tvorba renty na stáří.",
  },
  {
    href: "/portal/calculators/pension",
    icon: PiggyBank,
    title: "Penzijní kalkulačka",
    description: "Spočítejte si realitu státního důchodu a nutné úspory.",
  },
  {
    href: "/portal/calculators/life",
    icon: HeartPulse,
    title: "Životní pojištění",
    description: "Výpočet potřebného krytí pro zajištění rodiny a příjmů.",
  },
];

export function LifeCtaCards() {
  return (
    <div className="max-w-7xl mx-auto mt-20 mb-20 pt-10 border-t border-[#D6E6FF]/50">
      <h3 className="text-2xl font-bold text-[#0a0f29] mb-8 text-center">
        Spočítejte si sami
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {CALC_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center h-full border border-slate-200 hover:border-indigo-200 min-h-[44px]"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-slate-800 text-white group-hover:bg-indigo-600 transition-colors duration-300">
                <Icon className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-[#0a0f29] mb-2 transition-colors duration-300">
                {card.title}
              </h4>
              <p className="text-slate-500 group-hover:text-slate-700 text-sm transition-colors duration-300">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
