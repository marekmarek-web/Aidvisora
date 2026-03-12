"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { CalculatorChartCard } from "../core/CalculatorChartCard";
import { LifeInputPanel } from "./LifeInputPanel";
import { LifeResultsPanel } from "./LifeResultsPanel";
import { LifeRiskChart } from "./LifeRiskChart";
import { DEFAULT_STATE } from "@/lib/calculators/life/life.config";
import { runCalculations } from "@/lib/calculators/life/life.engine";
import type { LifeState } from "@/lib/calculators/life/life.types";

export function LifeCalculatorPage() {
  const [state, setState] = useState<LifeState>({ ...DEFAULT_STATE });
  const result = useMemo(() => runCalculations(state), [state]);

  return (
    <div className="pt-0">
      <CalculatorPageShell>
        <CalculatorPageHeader
          title="Kalkulačka životního pojištění"
          subtitle="Orientační výpočet potřebného krytí podle příjmů, výdajů a závazků."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <CalculatorInputSection>
            <LifeInputPanel state={state} onStateChange={setState} />
          </CalculatorInputSection>
          <CalculatorResultsSection>
            <div className="hidden lg:block sticky top-24">
              <LifeResultsPanel state={state} result={result} />
            </div>
          </CalculatorResultsSection>
        </div>

        <div className="hidden md:block">
          <CalculatorChartCard
            title="Analýza rizika (Měsíční bilance)"
            icon={
              <span className="text-[#fbbf24] text-sm font-bold uppercase">
                Graf
              </span>
            }
            caption="Graf znázorňuje propad příjmů v případě nemoci nebo invalidity a částku, kterou je třeba dokrýt. Oranžová část představuje finanční mezeru."
          >
            <LifeRiskChart chartData={result.chartData} />
          </CalculatorChartCard>
        </div>
      </CalculatorPageShell>

      {/* Mobile: floating result card at bottom */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-[420px] mx-auto pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
          <LifeResultsPanel state={state} result={result} />
        </div>
      </div>
    </div>
  );
}
