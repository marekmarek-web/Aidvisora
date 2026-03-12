"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type { AllocationChartData } from "@/lib/calculators/investment/investment.charts";

ChartJS.register(ArcElement, Tooltip);

export interface InvestmentAllocationChartProps {
  data: AllocationChartData;
}

export function InvestmentAllocationChart({ data }: InvestmentAllocationChartProps) {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        data: data.values,
        backgroundColor: data.colors,
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c: { label: string; parsed: number }) =>
            ` ${c.label}: ${c.parsed}%`,
        },
      },
    },
  };

  return (
    <div className="flex flex-col justify-center items-center gap-6">
      <div className="relative h-56 w-56">
        <Doughnut data={chartData} options={options} />
      </div>
      <div className="w-full max-w-xs space-y-2">
        {data.labels.map((label, i) => (
          <div
            key={label}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full shadow-sm shrink-0"
                style={{ backgroundColor: data.colors[i] }}
              />
              <span className="font-bold text-slate-700 text-sm">{label}</span>
            </div>
            <span className="font-bold text-[#0a0f29]">{data.values[i]} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}
