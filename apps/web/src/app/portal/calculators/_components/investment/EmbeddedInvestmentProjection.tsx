"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { computeProjection } from "@/lib/calculators/investment/investment.engine";
import { getGrowthChartData } from "@/lib/calculators/investment/investment.charts";
import { getProjectionFromFaStrategy } from "@/lib/calculators/investment/faStrategyAdapter";
import type { ProjectionInputs } from "@/lib/calculators/investment/investment.engine";
import type { FaStrategySlice } from "@/lib/calculators/investment/faStrategyAdapter";

const InvestmentGrowthChart = dynamic(
  () => import("./InvestmentGrowthChart").then((m) => m.InvestmentGrowthChart),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[300px] animate-pulse rounded-xl bg-[color:var(--wp-surface-muted)]" aria-hidden />
    ),
  },
);

export interface EmbeddedInvestmentProjectionProps {
  /** Direct inputs (standalone or CRM). */
  projectionInputs?: ProjectionInputs | null;
  /** FA data slice (investments + strategy + optional client). When set, overrides projectionInputs. */
  faDataSlice?: FaStrategySlice | null;
  /** Optional: custom empty message when there is nothing to show. */
  emptyMessage?: string;
}

/**
 * Reusable embedded projection block. Uses the same engine and chart as the standalone calculator.
 * Parity: same inputs → same projection and chart.
 */
export function EmbeddedInvestmentProjection({
  projectionInputs,
  faDataSlice,
  emptyMessage = "Vyplňte produkty a částky pro projekci.",
}: EmbeddedInvestmentProjectionProps) {
  const { growthChartData, hasInputs } = useMemo(() => {
    if (faDataSlice) {
      return getProjectionFromFaStrategy(faDataSlice);
    }
    if (projectionInputs && (projectionInputs.initial > 0 || projectionInputs.monthly > 0)) {
      const result = computeProjection(projectionInputs);
      const chartData = getGrowthChartData(result, projectionInputs.profile.color);
      return { growthChartData: chartData, hasInputs: true };
    }
    return {
      growthChartData: {
        labels: ["Start"],
        balanceData: [0],
        investedData: [0],
        profileColor: "#a855f7",
      },
      hasInputs: false,
    };
  }, [faDataSlice, projectionInputs]);

  if (!hasInputs) {
    return (
      <div className="flex items-center justify-center min-h-[300px] rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)] text-sm">
        {emptyMessage}
      </div>
    );
  }

  return <InvestmentGrowthChart data={growthChartData} />;
}
