"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { CalculatorModuleCard } from "../core/CalculatorModuleCard";
import { CalculatorModuleMainGrid } from "../core/CalculatorModuleMainGrid";
import { CalculatorMobileResultDock } from "../core/CalculatorMobileResultDock";
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
        <CalculatorModuleCard>
          <CalculatorPageHeader
            eyebrow="Kalkulačka penze · 2026"
            title="Penzijní kalkulačka"
            subtitle="Odhad státního důchodu, měsíční mezery k cílové rentě a nutné měsíční investice (náhradové poměry, demografický scénář)."
          />
          <p className="mt-3 max-w-3xl rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-slate-600">
            Výpočet je orientační projekce. Slouží jako podklad pro nastavení dlouhodobé
            důchodové strategie (DPS, DIP, ETF) podle reálných cílů klienta.
          </p>
        </CalculatorModuleCard>

        <CalculatorModuleMainGrid>
          <CalculatorInputSection>
            <PensionInputPanel
              state={state}
              onStateChange={setState}
              estimatedPension={result.estimatedPension}
            />
          </CalculatorInputSection>
          <CalculatorResultsSection>
            <div className="hidden lg:sticky lg:top-6 lg:block">
              <PensionResultsPanel result={result} />
            </div>
          </CalculatorResultsSection>
        </CalculatorModuleMainGrid>
      </CalculatorPageShell>

      <CalculatorMobileResultDock>
        <PensionResultsPanel result={result} />
      </CalculatorMobileResultDock>
    </div>
  );
}
