"use client";

import type { InvestmentProfile } from "@/lib/calculators/investment/investment.config";
import { Shield, Scale, Zap } from "lucide-react";

const PROFILE_ICONS = [Shield, Scale, Zap] as const;

export interface InvestmentStrategySwitcherProps {
  profiles: InvestmentProfile[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function InvestmentStrategySwitcher({
  profiles,
  activeIndex,
  onSelect,
}: InvestmentStrategySwitcherProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Vyberte strategii
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {profiles.map((profile, index) => {
          const Icon = PROFILE_ICONS[index] ?? Shield;
          const isActive = index === activeIndex;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`group flex min-h-[48px] touch-manipulation items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 ${
                isActive
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              }`}
              data-profile={index}
              aria-pressed={isActive}
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
              </span>
              <span className="truncate">{profile.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
