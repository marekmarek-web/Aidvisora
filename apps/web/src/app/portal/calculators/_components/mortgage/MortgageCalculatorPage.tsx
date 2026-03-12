"use client";

import { useMemo, useState } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorPageHeader } from "../core/CalculatorPageHeader";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { MortgageProductSwitcher } from "./MortgageProductSwitcher";
import { MortgageTabSwitcher } from "./MortgageTabSwitcher";
import { MortgageInputPanel } from "./MortgageInputPanel";
import { MortgageResultsPanel } from "./MortgageResultsPanel";
import { MortgageBankOffers } from "./MortgageBankOffers";
import {
  DEFAULT_STATE,
  LIMITS,
} from "@/lib/calculators/mortgage/mortgage.config";
import {
  calculateResult,
  getOffers,
} from "@/lib/calculators/mortgage/mortgage.engine";
import type { MortgageState } from "@/lib/calculators/mortgage/mortgage.types";

export function MortgageCalculatorPage() {
  const [state, setState] = useState<MortgageState>({
    ...DEFAULT_STATE,
    product: "mortgage",
    mortgageType: "standard",
    loanType: "consumer",
    loan: LIMITS.mortgage.default,
    own: 600_000,
    extra: 0,
    term: 30,
    fix: 5,
    type: "new",
    ltvLock: 90,
  });

  const result = useMemo(() => calculateResult(state), [state]);
  const offers = useMemo(() => getOffers(state), [state]);

  return (
    <div className="pt-0 pb-56 lg:pb-0">
      <CalculatorPageShell>
        <CalculatorPageHeader
          title="Kalkulačka hypoték a úvěrů"
          subtitle="Měsíční splátka hypotéky nebo úvěru podle zadaných parametrů. Srovnání nabídek bank."
        />

        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <MortgageProductSwitcher
            product={state.product}
            onProductChange={(product) =>
              setState((s) => ({
                ...s,
                product,
                ...(product === "mortgage"
                  ? {
                      loan: LIMITS.mortgage.default,
                      own: 600_000,
                      term: 30,
                      fix: 5,
                      type: "new" as const,
                      ltvLock: 90 as number | null,
                    }
                  : {
                      loan: LIMITS.loan.default,
                      own: 0,
                      term: 12,
                      ltvLock: null,
                    }),
              }))
            }
          />
          {state.product === "mortgage" && (
            <MortgageTabSwitcher
              type={state.type}
              onTypeChange={(type) => setState((s) => ({ ...s, type }))}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <CalculatorInputSection>
            <MortgageInputPanel
              state={state}
              onStateChange={setState}
            />
          </CalculatorInputSection>
          <CalculatorResultsSection>
            <div className="hidden lg:block sticky top-24">
              <MortgageResultsPanel result={result} />
            </div>
          </CalculatorResultsSection>
        </div>

        <div className="w-full">
          <MortgageBankOffers offers={offers} />
        </div>
      </CalculatorPageShell>

      {/* Mobile: floating result card at bottom (touch-friendly) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-[420px] mx-auto pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
          <MortgageResultsPanel result={result} />
        </div>
      </div>
    </div>
  );
}
