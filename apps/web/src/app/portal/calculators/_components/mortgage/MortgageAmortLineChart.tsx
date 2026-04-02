"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export interface MortgageAmortLineChartProps {
  data: ChartData<"line">;
  options: ChartOptions<"line">;
}

/** Chart.js line chart — lazy-loaded from MortgageAmortSection to keep chart.js off the main chunk. */
export function MortgageAmortLineChart({ data, options }: MortgageAmortLineChartProps) {
  return (
    <div className="relative h-[260px]">
      <Line data={data} options={options} />
    </div>
  );
}
