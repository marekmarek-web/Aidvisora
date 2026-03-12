"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
import { CalculatorChartCard } from "../core/CalculatorChartCard";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { InvestmentStrategySwitcher } from "./InvestmentStrategySwitcher";
import { InvestmentInputPanel } from "./InvestmentInputPanel";
import { InvestmentResultsPanel } from "./InvestmentResultsPanel";
import { InvestmentGrowthChart } from "./InvestmentGrowthChart";
import { InvestmentAllocationChart } from "./InvestmentAllocationChart";
import { InvestmentBacktestChart } from "./InvestmentBacktestChart";
import {
  INVESTMENT_PROFILES,
  HISTORICAL_DATA,
  INVESTMENT_DEFAULTS,
} from "@/lib/calculators/investment/investment.config";
import { computeProjection } from "@/lib/calculators/investment/investment.engine";
import { runBacktest } from "@/lib/calculators/investment/investment.backtest";
import {
  getGrowthChartData,
  getAllocationChartData,
  getBacktestChartSeries,
} from "@/lib/calculators/investment/investment.charts";
import { formatCurrency } from "@/lib/calculators/investment/formatters";

export function InvestmentCalculatorPage() {
  const [initial, setInitial] = useState<number>(INVESTMENT_DEFAULTS.initialDefault);
  const [monthly, setMonthly] = useState<number>(INVESTMENT_DEFAULTS.monthlyDefault);
  const [years, setYears] = useState<number>(INVESTMENT_DEFAULTS.yearsDefault);
  const [profileIndex, setProfileIndex] = useState<number>(INVESTMENT_DEFAULTS.profileIndexDefault);
  const [startYear, setStartYear] = useState<number>(INVESTMENT_DEFAULTS.startYearDefault);

  const profile = INVESTMENT_PROFILES[profileIndex] ?? INVESTMENT_PROFILES[1];

  const projection = useMemo(
    () =>
      computeProjection({
        initial,
        monthly,
        years,
        profile,
      }),
    [initial, monthly, years, profile],
  );

  const backtestResult = useMemo(
    () => runBacktest(monthly, startYear, HISTORICAL_DATA),
    [monthly, startYear],
  );

  const growthChartData = useMemo(
    () => getGrowthChartData(projection, profile.color),
    [projection, profile.color],
  );

  const allocationChartData = useMemo(
    () => getAllocationChartData(profile),
    [profile],
  );

  const backtestSeries = useMemo(
    () => getBacktestChartSeries(backtestResult),
    [backtestResult],
  );

  return (
    <div className="pt-0">
      <CalculatorPageShell>
        <CalculatorPageHeader
          title="Investiční kalkulačka"
          subtitle="Projekce hodnoty investice v čase při pravidelném investování a zvolené strategii."
        />

        <div className="flex flex-wrap items-center gap-4">
          <InvestmentStrategySwitcher
            profiles={INVESTMENT_PROFILES}
            activeIndex={profileIndex}
            onSelect={setProfileIndex}
          />
          <span className="text-sm text-slate-500">
            Strategie: {profile.name} ({profile.rate} % p.a.)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <CalculatorInputSection>
            <InvestmentInputPanel
              initial={initial}
              monthly={monthly}
              years={years}
              onInitialChange={(v) => setInitial(v)}
              onMonthlyChange={(v) => setMonthly(v)}
              onYearsChange={(v) => setYears(v)}
              profileTitle={profile.name}
              profileDescription={profile.description}
            />
          </CalculatorInputSection>
          <CalculatorResultsSection>
            <InvestmentResultsPanel
              totalBalance={projection.totalBalance}
              totalInvested={projection.totalInvested}
              totalGain={projection.totalGain}
              totalGainPercent={projection.totalGainPercent}
            />
          </CalculatorResultsSection>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <CalculatorChartCard
            title="Projekce vývoje"
            icon={<span className="text-[#fbbf24]">📈</span>}
            caption="Graf ukazuje odhadovaný vývoj hodnoty investice v čase při pravidelném investování a zvolené strategii."
          >
            <InvestmentGrowthChart data={growthChartData} />
          </CalculatorChartCard>
          <CalculatorChartCard
            title="Složení portfolia"
            icon={<span className="text-[#fbbf24]">📊</span>}
          >
            <InvestmentAllocationChart data={allocationChartData} />
          </CalculatorChartCard>
        </div>

        <div className="bg-white rounded-[var(--wp-radius-sm)] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-10">
            <InvestmentBacktestChart
              series={backtestSeries}
              monthlyFormatted={formatCurrency(monthly)}
              startYear={startYear}
              onStartYearChange={setStartYear}
            />
          </div>
        </div>
      </CalculatorPageShell>
    </div>
  );
}
