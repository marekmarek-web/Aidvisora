"use client";

import Link from "next/link";
import { Calculator, PiggyBank, HeartPulse } from "lucide-react";

export interface InvestmentCtaSectionProps {
  onPrimaryCta: () => void;
}

const CALC_CARDS = [
  {
    href: "/hypotecnikalkulacka/",
    icon: Calculator,
    title: "Hypoteční kalkulačka",
    description: "Spočítejte si splátku Vaší hypotéky na základě zadaných parametrů.",
  },
  {
    href: "/penzijnikalkulacka/",
    icon: PiggyBank,
    title: "Penzijní kalkulačka",
    description: "Spočítejte si realitu státního důchodu a nutné úspory.",
  },
  {
    href: "/zivotnikalkulacka/",
    icon: HeartPulse,
    title: "Životní pojištění",
    description: "Výpočet potřebného krytí pro zajištění rodiny a příjmů.",
  },
];

export function InvestmentCtaSection({ onPrimaryCta }: InvestmentCtaSectionProps) {
  return (
    <>
      <div className="mt-12">
        <div className="bg-gradient-to-r from-[#0a0f29] to-[#1e3a6e] rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#fbbf24] opacity-10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#fbbf24] opacity-10 rounded-full blur-xl -ml-10 -mb-10" />

          <h2 className="text-3xl font-extrabold text-white mb-4 relative z-10">
            Chcete investiční plán přizpůsobený vaší situaci?
          </h2>
          <p className="text-lg text-blue-100 max-w-3xl mx-auto mb-8 relative z-10">
            Výsledek z kalkulačky může sloužit jako základ pro sestavení konkrétní investiční strategie podle vašich cílů, příjmů a časového horizontu.
          </p>
          <button
            type="button"
            onClick={onPrimaryCta}
            className="group relative inline-block w-full sm:w-auto bg-gradient-to-r from-[#fbbf24] to-[#fde047] hover:to-[#fbbf24] text-[#0a0f29] font-extrabold py-5 px-8 rounded-xl shadow-lg shadow-[#fbbf24]/30 transition-all transform hover:scale-[1.02] overflow-hidden text-center"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-white/30 skew-x-[-20deg] animate-shimmer" />
            <div className="relative flex items-center justify-center gap-3 text-lg uppercase tracking-wider">
              Chci investiční plán
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </button>
        </div>
      </div>

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
                className="group bg-white hover:bg-gradient-to-br hover:from-white hover:to-[#fde047]/30 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center h-full border border-slate-200 hover:border-[#fbbf24]/30"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-[#0a0f29] text-white group-hover:bg-[#fbbf24] transition-colors duration-300">
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
    </>
  );
}
