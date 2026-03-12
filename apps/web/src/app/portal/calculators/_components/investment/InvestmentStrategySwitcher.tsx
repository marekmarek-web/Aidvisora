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
    <div className="flex flex-col gap-4">
      <label className="text-xs font-bold text-blue-200 uppercase tracking-widest">
        Vyberte strategii
      </label>
      <div className="inline-flex bg-slate-900/50 p-1.5 rounded-xl backdrop-blur-md border border-white/10 w-full sm:w-fit flex-wrap gap-2 sm:gap-1">
        {profiles.map((profile, index) => {
          const Icon = PROFILE_ICONS[index] ?? Shield;
          const isActive = index === activeIndex;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all duration-200 min-h-[44px] touch-manipulation ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
              data-profile={index}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {index === 0 && "Konzervativní"}
              {index === 1 && "Vyvážená"}
              {index === 2 && "Dynamická"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
