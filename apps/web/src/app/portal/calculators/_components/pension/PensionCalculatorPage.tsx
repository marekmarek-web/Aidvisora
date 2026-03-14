"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { PensionInputPanel } from "./PensionInputPanel";
import { PensionResultsPanel } from "./PensionResultsPanel";
import { DEFAULT_STATE } from "@/lib/calculators/pension/pension.config";
import { runCalculations } from "@/lib/calculators/pension/pension.engine";
import type { PensionState } from "@/lib/calculators/pension/pension.types";

export function PensionCalculatorPage() {
  const [state, setState] = useState<PensionState>({ ...DEFAULT_STATE });
  const result = useMemo(() => runCalculations(state), [state]);

  return (
    <div className="pt-0 pb-56 lg:pb-0">
      <CalculatorPageShell>
        <CalculatorPageHeader
          title="Penzijní kalkulačka"
          subtitle="Odhad státního důchodu, měsíční mezery k cílové rentě a nutné měsíční investice (náhradové poměry, demografický scénář)."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <CalculatorInputSection>
            <PensionInputPanel
              state={state}
              onStateChange={setState}
              estimatedPension={result.estimatedPension}
            />
          </CalculatorInputSection>
          <CalculatorResultsSection>
            <div className="hidden lg:block sticky top-24">
              <PensionResultsPanel result={result} />
            </div>
          </CalculatorResultsSection>
        </div>
      </CalculatorPageShell>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-fixed-cta p-3 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-[420px] mx-auto pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
          <PensionResultsPanel result={result} />
        </div>
      </div>
    </div>
  );
}
