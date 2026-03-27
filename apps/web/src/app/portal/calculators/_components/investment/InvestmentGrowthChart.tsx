"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          titleColor: isDark ? "#f1f5f9" : "#0f172a",
          bodyColor: isDark ? "#e2e8f0" : "#0f172a",
          borderColor: isDark ? "#334155" : "#e2e8f0",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (tooltipItem: TooltipItem<"line">) =>
              `${tooltipItem.dataset?.label ?? ""}: ${new Intl.NumberFormat("cs-CZ").format(tooltipItem.parsed?.y ?? 0)} Kč`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: isDark ? "rgba(148,163,184,0.12)" : "#eef2ff" },
          border: { display: false },
          ticks: {
            color: isDark ? "#94a3b8" : "#64748b",
            callback: (v: number | string) =>
              Number(v) >= 1_000_000
                ? `${(Number(v) / 1_000_000).toFixed(1)}M`
                : `${(Number(v) / 1_000).toFixed(0)}k`,
          },
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { maxTicksLimit: 6, color: isDark ? "#94a3b8" : "#94a3b8" },
        },
      },
    }),
    [isDark],
  );

  return (
    <div className="h-[280px] w-full sm:h-[300px]">
      <Line data={chartData} options={options} />
    </div>
  );
}
