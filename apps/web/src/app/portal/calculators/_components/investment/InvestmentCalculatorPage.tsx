"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
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
    <div className="pt-0 pb-8 sm:pb-12">
      <CalculatorPageShell>
        <div className="rounded-[28px] border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <CalculatorPageHeader
            title="Investiční kalkulačka"
            subtitle="Projekce hodnoty investice v čase při pravidelném investování a zvolené strategii."
          />
          <div className="mt-5">
            <InvestmentStrategySwitcher
              profiles={INVESTMENT_PROFILES}
              activeIndex={profileIndex}
              onSelect={setProfileIndex}
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Strategie: <span className="text-slate-800">{profile.name}</span>{" "}
              <span className="text-slate-400">({profile.rate} % p.a.)</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 items-start">
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
            <div className="lg:sticky lg:top-6">
              <InvestmentResultsPanel
                totalBalance={projection.totalBalance}
                totalInvested={projection.totalInvested}
                totalGain={projection.totalGain}
                totalGainPercent={projection.totalGainPercent}
              />
            </div>
          </CalculatorResultsSection>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <header className="mb-4 space-y-1">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <span className="text-indigo-500">📈</span>
                Projekce vývoje
              </h3>
              <p className="text-sm text-slate-500">
                Graf ukazuje odhadovaný vývoj hodnoty investice v čase při pravidelném investování a zvolené strategii.
              </p>
            </header>
            <InvestmentGrowthChart data={growthChartData} />
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <header className="mb-4 space-y-1">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <span className="text-indigo-500">📊</span>
                Složení portfolia
              </h3>
              <p className="text-sm text-slate-500">
                Rozdělení strategie podle jednotlivých tříd aktiv.
              </p>
            </header>
            <InvestmentAllocationChart data={allocationChartData} />
          </section>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
          <div className="p-5 sm:p-6 md:p-8">
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
