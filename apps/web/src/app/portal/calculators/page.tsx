import Link from "next/link";
import { TrendingUp, Calculator, PiggyBank, HeartPulse } from "lucide-react";
import { getCalculators } from "@/lib/calculators/core/registry";
import type { CalculatorIconId } from "@/lib/calculators/core/types";

const ICON_MAP: Record<CalculatorIconId, React.ComponentType<{ className?: string }>> = {
  "trending-up": TrendingUp,
  calculator: Calculator,
  "piggy-bank": PiggyBank,
  "heart-pulse": HeartPulse,
  "circle-help": Calculator,
};

export default function CalculatorsPage() {
  const calculators = getCalculators();

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Kalkulačky
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hypoteční, investiční a další kalkulačky pro poradce.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {calculators.map((def) => {
            const Icon = ICON_MAP[def.icon] ?? Calculator;
            const isActive = def.status === "active";
            const cardContent = (
              <>
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? "bg-[#0a0f29] text-white group-hover:bg-[#fbbf24]"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <h2
                  className={`font-bold transition-colors ${
                    isActive ? "text-slate-900" : "text-slate-600"
                  }`}
                >
                  {def.title}
                </h2>
                <p className="text-sm text-slate-500">
                  {def.status === "coming_soon" ? "Připravuje se." : def.description}
                </p>
              </>
            );

            if (isActive) {
              return (
                <Link
                  key={def.id}
                  href={def.route}
                  className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white p-6 hover:border-[#fbbf24]/30 hover:shadow-lg transition-all flex flex-col items-center text-center gap-3 group"
                >
                  {cardContent}
                </Link>
              );
            }

            return (
              <div
                key={def.id}
                className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center text-center gap-3 opacity-75"
              >
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
