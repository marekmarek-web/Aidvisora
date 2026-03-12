"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { TooltipItem } from "chart.js";
import type { GrowthChartData } from "@/lib/calculators/investment/investment.charts";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

export interface InvestmentGrowthChartProps {
  data: GrowthChartData;
}

export function InvestmentGrowthChart({ data }: InvestmentGrowthChartProps) {
  const chartData = useMemo(
    () => ({
      labels: data.labels,
      datasets: [
        {
          label: "Celková hodnota",
          data: data.balanceData,
          borderColor: data.profileColor,
          backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D; height: number } }) => {
            const ctx = context.chart.ctx;
            const h = context.chart.height;
            const gradient = ctx.createLinearGradient(0, 0, 0, h);
            gradient.addColorStop(0, data.profileColor + "66");
            gradient.addColorStop(1, data.profileColor + "00");
            return gradient;
          },
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
        },
        {
          label: "Váš vklad",
          data: data.investedData,
          borderColor: "#cbd5e1",
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
        },
      ],
    }),
    [data],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (tooltipItem: TooltipItem<"line">) =>
              `${tooltipItem.dataset?.label ?? ""}: ${new Intl.NumberFormat("cs-CZ").format(tooltipItem.parsed?.y ?? 0)} Kč`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: "#f1f5f9" },
          ticks: {
            callback: (v: number | string) =>
              Number(v) >= 1_000_000
                ? `${(Number(v) / 1_000_000).toFixed(1)}M`
                : `${(Number(v) / 1_000).toFixed(0)}k`,
          },
        },
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 6 },
        },
      },
    }),
    [],
  );

  return (
    <div className="h-[300px] w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
