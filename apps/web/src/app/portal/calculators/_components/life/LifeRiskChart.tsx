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
    <div className="h-full py-4">
      <div className="flex items-end justify-around gap-4 md:gap-6">
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
                className="w-full min-h-[4px] rounded-t-lg bg-gradient-to-t from-indigo-500 to-indigo-400 transition-all duration-500 ease-out"
                style={{ height: `${chybiHeight}%` }}
              >
                {item.chybi > 0 && (
                  <span className="absolute left-1/2 -top-6 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-[#0a0f29] opacity-0 transition-opacity group-hover:opacity-100">
                    {formatCurrency(item.chybi)} Kč
                  </span>
                )}
              </div>
              <div
                className="w-full min-h-[4px] rounded-b-lg bg-slate-300 transition-all duration-500 ease-out"
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
      <div className="mt-5 flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-4 text-xs">
        <span className="inline-flex items-center gap-2 text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          Krytí od státu
        </span>
        <span className="inline-flex items-center gap-2 font-semibold text-indigo-600">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          Finanční mezera
        </span>
      </div>
    </div>
  );
}
