"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
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
        <div className="rounded-[28px] border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <CalculatorPageHeader
            title="Kalkulačka životního pojištění"
            subtitle="Orientační výpočet potřebného krytí podle příjmů, výdajů a závazků."
          />
          <p className="mt-3 max-w-3xl rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-slate-600">
            Výsledky jsou modelové doporučení minimálního krytí. Finální nastavení
            vždy závisí na konkrétní smlouvě, zdravotním stavu a rodinné situaci.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <CalculatorInputSection>
            <LifeInputPanel state={state} onStateChange={setState} />
          </CalculatorInputSection>
          <CalculatorResultsSection>
            <div className="hidden lg:sticky lg:top-6 lg:block">
              <LifeResultsPanel state={state} result={result} />
            </div>
          </CalculatorResultsSection>
        </div>

        <div className="hidden md:block">
          <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <header className="mb-4 space-y-1">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <span className="text-indigo-500">📊</span>
                Analýza rizika (měsíční bilance)
              </h3>
              <p className="text-sm text-slate-500">
                Graf znázorňuje propad příjmů v případě nemoci nebo invalidity a částku,
                kterou je třeba dokrýt. Oranžová část představuje finanční mezeru.
              </p>
            </header>
            <LifeRiskChart chartData={result.chartData} />
          </section>
        </div>
      </CalculatorPageShell>

      {/* Mobile: floating result card at bottom */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-fixed-cta p-3 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-[420px] mx-auto pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
          <LifeResultsPanel state={state} result={result} />
        </div>
      </div>
    </div>
  );
}
