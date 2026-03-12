"use client";

import { useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { BacktestChartSeriesItem } from "@/lib/calculators/investment/investment.charts";
import { BACKTEST_CHART_COLORS } from "@/lib/calculators/investment/investment.charts";
import { formatCurrency } from "@/lib/calculators/investment/formatters";
import { CZECH_MONTHS } from "@/lib/calculators/investment/investment.constants";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export interface InvestmentBacktestChartProps {
  series: BacktestChartSeriesItem[];
  /** Monthly amount for label */
  monthlyFormatted: string;
  startYear: number;
  onStartYearChange: (year: number) => void;
}

const START_YEAR_MIN = 1995;
const START_YEAR_MAX = 2019;

/** Build custom tooltip that always shows all series values from full data (fixes legend-toggle bug). */
function buildCustomTooltip(
  fullSeries: BacktestChartSeriesItem[],
  formatValue: (v: number) => string,
  formatDate: (ts: number) => string,
) {
  return function customTooltip(opts: {
    dataPointIndex: number;
    w: { globals: { series: (number | null)[][]; initialSeries: { data: [number, number][] }[] } };
  }) {
    const { dataPointIndex, w } = opts;
    if (dataPointIndex == null || !fullSeries.length) return "";

    const firstSeriesData = fullSeries[0]?.data ?? [];
    const point = firstSeriesData[dataPointIndex];
    if (!point) return "";

    const [xTs] = point;
    const dateStr = formatDate(xTs);

    const rows = fullSeries
      .map((s, i) => {
        const pt = s.data[dataPointIndex];
        const val = pt ? pt[1] : null;
        const color = BACKTEST_CHART_COLORS[i] ?? "#94a3b8";
        if (val == null) return "";
        return `<div style="display:flex;align-items:center;gap:6px;margin:4px 0">
          <span style="width:10px;height:10px;border-radius:50%;background:${color}"></span>
          <span>${s.name}: ${formatValue(val)}</span>
        </div>`;
      })
      .filter(Boolean);

    return `<div style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);min-width:180px">
      <div style="font-weight:600;color:#0f172a;margin-bottom:8px">${dateStr}</div>
      ${rows.join("")}
    </div>`;
  };
}

export function InvestmentBacktestChart({
  series,
  monthlyFormatted,
  startYear,
  onStartYearChange,
}: InvestmentBacktestChartProps) {
  const fullSeriesRef = useRef(series);

  useEffect(() => {
    fullSeriesRef.current = series;
  }, [series]);

  const options = useMemo((): ApexOptions => {
    const formatDate = (ts: number) => {
      const d = new Date(ts);
      return `${CZECH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    };

    return {
      chart: {
        type: "area",
        height: 500,
        fontFamily: "Inter, sans-serif",
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
      },
      colors: [...BACKTEST_CHART_COLORS],
      stroke: { curve: "smooth", width: [0, 2, 2, 2, 2] },
      fill: {
        type: ["solid", "gradient", "solid", "solid", "solid"],
        gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] },
        opacity: [0.3, 0.5, 1, 1, 1],
      },
      dataLabels: { enabled: false },
      grid: {
        borderColor: "#f1f5f9",
        strokeDashArray: 3,
        xaxis: { lines: { show: true } },
      },
      xaxis: {
        type: "datetime",
        tooltip: { enabled: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: "#94a3b8" } },
      },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            val >= 1_000_000
              ? `${(val / 1_000_000).toFixed(1)}M`
              : val >= 1_000
                ? `${(val / 1_000).toFixed(0)}k`
                : String(val),
          style: { colors: "#94a3b8" },
        },
      },
      tooltip: {
        theme: "light",
        shared: true,
        intersect: false,
        custom: function (opts: Parameters<ReturnType<typeof buildCustomTooltip>>[0]) {
          return buildCustomTooltip(
            fullSeriesRef.current,
            formatCurrency,
            (ts) => {
              const d = new Date(ts);
              return `${CZECH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
            },
          )(opts);
        },
      },
      legend: {
        position: "top",
        horizontalAlign: "right",
        onItemClick: {
          toggleDataSeries: true,
        },
      },
      markers: { size: 0 },
      annotations: {
        xaxis: [
          { x: new Date("2000-03-01").getTime(), borderColor: "#EF4444", strokeDashArray: 2, label: { text: "Dot-com", style: { color: "#fff", background: "#EF4444" } } },
          { x: new Date("2008-09-01").getTime(), borderColor: "#EF4444", strokeDashArray: 2, label: { text: "Krize 2008", style: { color: "#fff", background: "#EF4444" } } },
          { x: new Date("2020-03-01").getTime(), borderColor: "#EF4444", strokeDashArray: 2, label: { text: "COVID-19", style: { color: "#fff", background: "#EF4444" } } },
          { x: new Date("2022-02-01").getTime(), borderColor: "#EF4444", strokeDashArray: 2, label: { text: "Válka/Inflace", style: { color: "#fff", background: "#EF4444" } } },
        ],
      },
    };
  }, []);

  const apexSeries = useMemo(
    () =>
      series.map((s) => ({
        name: s.name,
        type: s.type,
        data: s.data,
      })),
    [series],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-4">
        <div>
          <h3 className="text-2xl md:text-3xl font-bold text-[#0a0f29] flex items-center gap-3">
            <svg className="w-8 h-8 text-indigo-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Simulace historického vývoje
          </h3>
          <p className="text-slate-600 mt-2 text-lg">
            Jak by dopadla vaše investice{" "}
            <span className="font-bold text-[#0B3A7A]">{monthlyFormatted}</span>{" "}
            měsíčně, kdybyste začali v roce{" "}
            <span className="font-bold text-[#0B3A7A]">{startYear}</span>?
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-green-50 text-green-700 px-4 py-2 rounded-full border border-green-100">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Reálná tržní data 1995–2024
        </div>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
        Historická simulace ukazuje, jak by se investice vyvíjela při zachování dlouhodobé strategie i v obdobích krizí a poklesů trhu.
      </p>

      <div className="w-full h-[500px]">
        <ReactApexChart options={options} series={apexSeries} type="area" height={500} />
      </div>

      <div className="mt-10 bg-slate-50 rounded-2xl p-6 border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
            Posunout v čase (Start investice)
          </span>
          <span className="text-lg font-bold text-[#0a0f29] bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            Rok {startYear}
          </span>
        </div>
        <input
          type="range"
          min={START_YEAR_MIN}
          max={START_YEAR_MAX}
          step={1}
          value={startYear}
          onChange={(e) => onStartYearChange(parseInt(e.target.value, 10))}
          className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer min-h-[44px] touch-manipulation"
        />
        <div className="flex justify-between text-xs font-bold text-slate-400 mt-3 uppercase tracking-wide">
          <span className="flex flex-col items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" /></svg>
            1995 (Dot-com)
          </span>
          <span className="flex flex-col items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" /></svg>
            2008 (Krize)
          </span>
          <span className="flex flex-col items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" /></svg>
            2019 (Covid)
          </span>
        </div>
      </div>
    </div>
  );
}
