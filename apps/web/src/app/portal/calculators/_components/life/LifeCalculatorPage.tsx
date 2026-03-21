"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { CalculatorModuleCard } from "../core/CalculatorModuleCard";
import { CalculatorModuleMainGrid } from "../core/CalculatorModuleMainGrid";
import { CalculatorMobileResultDock } from "../core/CalculatorMobileResultDock";
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
    <div className="pt-0 pb-56 lg:pb-0">
      <CalculatorPageShell>
        <CalculatorModuleCard>
          <CalculatorPageHeader
            eyebrow="Kalkulačka pojištění · 2026"
            title="Kalkulačka životního pojištění"
            subtitle="Orientační výpočet potřebného krytí podle příjmů, výdajů a závazků."
          />
          <p className="mt-3 max-w-3xl rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-slate-600">
            Výsledky jsou modelové doporučení minimálního krytí. Finální nastavení
            vždy závisí na konkrétní smlouvě, zdravotním stavu a rodinné situaci.
          </p>
        </CalculatorModuleCard>

        <CalculatorModuleMainGrid>
          <CalculatorInputSection>
            <LifeInputPanel state={state} onStateChange={setState} />
          </CalculatorInputSection>
          <CalculatorResultsSection>
            <div className="hidden lg:sticky lg:top-6 lg:block">
              <LifeResultsPanel state={state} result={result} />
            </div>
          </CalculatorResultsSection>
        </CalculatorModuleMainGrid>

        <div className="hidden md:block">
          <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <header className="mb-4 space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Analýza rizika (měsíční bilance)</h3>
              <p className="text-sm text-slate-500">
                Graf znázorňuje propad příjmů v případě nemoci nebo invalidity a částku,
                kterou je třeba dokrýt. Oranžová část představuje finanční mezeru.
              </p>
            </header>
            <LifeRiskChart chartData={result.chartData} />
          </section>
        </div>
      </CalculatorPageShell>

      <CalculatorMobileResultDock>
        <LifeResultsPanel state={state} result={result} />
      </CalculatorMobileResultDock>
    </div>
  );
}
