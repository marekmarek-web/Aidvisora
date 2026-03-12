"use client";

import { formatCurrency } from "@/lib/calculators/life/formatters";
import type { LifeChartDataItem } from "@/lib/calculators/life/life.types";

export interface LifeRiskChartProps {
  chartData: LifeChartDataItem[];
}

export function LifeRiskChart({ chartData }: LifeRiskChartProps) {
  if (!chartData.length) return null;

  const maxVal = Math.max(
    ...chartData.flatMap((d) => [d.prijem, d.stat + d.chybi])
  );
  if (maxVal <= 0) return null;

  return (
    <div className="flex justify-around items-end h-full py-4 gap-4 md:gap-6">
      {chartData.map((item) => {
        const statHeight = (item.stat / maxVal) * 100;
        const chybiHeight = (item.chybi / maxVal) * 100;
        return (
          <div
            key={item.label}
            className="relative flex-1 max-w-[120px] md:max-w-[140px] h-48 md:h-64 flex flex-col justify-end items-center group"
          >
            <div className="w-full h-full flex flex-col justify-end items-center">
              <div
                className="w-full bg-[#fbbf24] rounded-t-lg transition-all duration-500 ease-out min-h-[4px]"
                style={{ height: `${chybiHeight}%` }}
              >
                {item.chybi > 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 -top-6 text-xs font-bold text-[#0a0f29] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {formatCurrency(item.chybi)} Kč
                  </span>
                )}
              </div>
              <div
                className="w-full bg-[#cbd5e1] rounded-b-lg transition-all duration-500 ease-out min-h-[4px]"
                style={{ height: `${statHeight}%` }}
              />
            </div>
            <div className="text-xs font-bold text-slate-600 mt-2 text-center">
              {item.label}
            </div>
            <div className="text-xs text-slate-400">
              {formatCurrency(item.prijem)} Kč
            </div>
          </div>
        );
      })}
    </div>
  );
}
