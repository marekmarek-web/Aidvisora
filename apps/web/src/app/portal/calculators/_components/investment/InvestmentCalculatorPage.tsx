"use client";

import { useMemo, useState, useCallback } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorHero } from "../core/CalculatorHero";
import { CalculatorChartCard } from "../core/CalculatorChartCard";
import { CalculatorInfoCard } from "../core/CalculatorInfoCard";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { InvestmentStrategySwitcher } from "./InvestmentStrategySwitcher";
import { InvestmentInputPanel } from "./InvestmentInputPanel";
import { InvestmentResultsPanel } from "./InvestmentResultsPanel";
import { InvestmentGrowthChart } from "./InvestmentGrowthChart";
import { InvestmentAllocationChart } from "./InvestmentAllocationChart";
import { InvestmentBacktestChart } from "./InvestmentBacktestChart";
import { InvestmentFaqSection } from "./InvestmentFaqSection";
import { InvestmentCtaSection } from "./InvestmentCtaSection";
import { InvestmentContactModal } from "./InvestmentContactModal";
import {
  INVESTMENT_PROFILES,
  INVESTMENT_FAQ,
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
  const [modalOpen, setModalOpen] = useState(false);

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

  const onCtaClick = useCallback(() => setModalOpen(true), []);

  return (
    <div className="pt-0">
      <section className="bg-[#EAF3FF] pt-28 pb-10 px-4 md:py-20 lg:pt-32">
        <CalculatorPageShell maxWidth="max-w-7xl" className="mb-10">
          <CalculatorHero
            title={
              <>
                Investiční kalkulačka – výpočet
                <br />
                <span className="text-[#fbbf24]">hodnoty investice v čase</span>
              </>
            }
            subtitle="Spočítejte si orientačně, jak se může vyvíjet vaše pravidelná investice v čase podle zvolené strategie. Výsledky slouží jako podklad pro další plánování."
            badge={
              <div className="bg-white rounded-xl py-4 px-6 shadow-lg flex flex-col items-center justify-center text-center gap-1">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Předpokládaný výnos
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-extrabold text-4xl text-[#0a0f29]">
                    {profile.rate}
                  </span>
                  <span className="font-bold text-xl text-[#fbbf24]">% p.a.</span>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {profile.name}
                </span>
              </div>
            }
          >
            <InvestmentStrategySwitcher
              profiles={INVESTMENT_PROFILES}
              activeIndex={profileIndex}
              onSelect={setProfileIndex}
            />
          </CalculatorHero>

          <div className="mt-8 mb-10 max-w-7xl mx-auto px-4">
            <CalculatorInfoCard
              title="Informace ke kalkulaci"
              icon={
                <svg className="w-4 h-4 text-[#fbbf24]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              }
            >
              <>
                <p>
                  Tato kalkulačka slouží k orientačnímu výpočtu, jak se může vyvíjet hodnota vaší investice v čase při pravidelném investování.
                  Zohledňuje výši počátečního vklad, měsíční investici, investiční horizont a zvolenou strategii.
                </p>
                <p>
                  Výsledkem je přehledná projekce budoucí hodnoty investice a celkového zhodnocení.
                  Kalkulačka pracuje s dlouhodobým pohledem a principem složeného úročení.
                </p>
                <p>
                  Výpočty jsou orientační a nezohledňují individuální daňové či legislativní aspekty.
                </p>
                <p>
                  Slouží jako podklad pro pochopení rozdílů mezi jednotlivými strategiemi a pro další rozhodování.
                </p>
              </>
            </CalculatorInfoCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-10">
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
                onCtaClick={onCtaClick}
              />
            </CalculatorResultsSection>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
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

          <div className="mt-12 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 md:p-10">
              <InvestmentBacktestChart
                series={backtestSeries}
                monthlyFormatted={formatCurrency(monthly)}
                startYear={startYear}
                onStartYearChange={setStartYear}
              />
            </div>
          </div>

          <InvestmentFaqSection items={INVESTMENT_FAQ} />
          <InvestmentCtaSection onPrimaryCta={onCtaClick} />
        </CalculatorPageShell>
      </section>

      <InvestmentContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        profileName={profile.name}
        initial={initial}
        monthly={monthly}
        years={years}
      />
    </div>
  );
}
