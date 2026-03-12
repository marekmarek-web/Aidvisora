"use client";

import { useMemo, useState, useCallback } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorHero } from "../core/CalculatorHero";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { CalculatorInfoCard } from "../core/CalculatorInfoCard";
import { CalculatorCtaBlock } from "../core/CalculatorCtaBlock";
import { PensionInputPanel } from "./PensionInputPanel";
import { PensionResultsPanel } from "./PensionResultsPanel";
import { PensionContactModal } from "./PensionContactModal";
import { PensionCtaCards } from "./PensionCtaCards";
import { DEFAULT_STATE } from "@/lib/calculators/pension/pension.config";
import { runCalculations } from "@/lib/calculators/pension/pension.engine";
import type { PensionState } from "@/lib/calculators/pension/pension.types";
import { PiggyBank } from "lucide-react";

export function PensionCalculatorPage() {
  const [state, setState] = useState<PensionState>({ ...DEFAULT_STATE });
  const [modalOpen, setModalOpen] = useState(false);

  const result = useMemo(() => runCalculations(state), [state]);

  const onCtaPrimary = useCallback(() => {
    setModalOpen(true);
  }, []);

  return (
    <div className="pt-0">
      <section className="bg-[#EAF3FF] pt-28 pb-[280px] px-4 md:py-20 md:pb-10 lg:pt-32">
        <CalculatorPageShell maxWidth="max-w-7xl" className="mb-10">
          <CalculatorHero
            title={
              <>
                Realita důchodů 2026:
                <br />
                <span className="text-[#fbbf24]">Stát se o vás nepostará.</span>
              </>
            }
            subtitle="Spočítejte si orientačně odhad státního důchodu, měsíční mezeru k cílové rentě a nutnou měsíční investici. Výpočet vychází z náhradových poměrů a demografického scénáře."
            badge={
              <div className="bg-white rounded-xl py-4 px-6 shadow-lg flex flex-col items-center justify-center text-center gap-1">
                <PiggyBank className="w-8 h-8 text-[#fbbf24] mx-auto" />
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Důchodová mezera
                </span>
              </div>
            }
          />

          <div className="mt-8 mb-10">
            <CalculatorInfoCard
              title="Informace ke kalkulaci"
              icon={
                <svg
                  className="w-4 h-4 text-[#fbbf24]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            >
              <>
                <p>
                  Kalkulačka odhaduje výši státního důchodu podle hrubé mzdy a
                  věku odchodu do důchodu. Realistický scénář zohledňuje
                  demografický tlak na systém. Z měsíční mezery mezi cílovou rentou
                  a odhadem důchodu spočítáme nutnou měsíční investici a cílový
                  majetek (předpoklad 7 % zhodnocení, 2 % inflace, 20 let výběru).
                </p>
                <p>
                  Výsledek slouží k orientaci. Konkrétní plán doporučujeme
                  řešit v rámci konzultace.
                </p>
              </>
            </CalculatorInfoCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-10">
            <CalculatorInputSection>
              <PensionInputPanel
                state={state}
                onStateChange={setState}
                estimatedPension={result.estimatedPension}
              />
            </CalculatorInputSection>
            <CalculatorResultsSection>
              <div className="hidden lg:block sticky top-24">
                <PensionResultsPanel result={result} onCtaPrimary={onCtaPrimary} />
              </div>
            </CalculatorResultsSection>
          </div>

          <CalculatorCtaBlock
            title="Chcete tento plán nastavit?"
            description="Rád s vámi proberu cílovou rentu, časový horizont a vhodné nástroje (DPS, fondy). Nechte kontakt a ozvu se."
            cta={
              <button
                type="button"
                onClick={onCtaPrimary}
                className="group relative inline-flex items-center gap-3 bg-[#fbbf24] hover:bg-[#fde047] text-[#0a0f29] font-bold py-4 px-8 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 min-h-[44px]"
              >
                Chci tento plán nastavit
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </button>
            }
          />

          <PensionCtaCards />
        </CalculatorPageShell>
      </section>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-[420px] mx-auto pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
          <PensionResultsPanel result={result} onCtaPrimary={onCtaPrimary} />
        </div>
      </div>

      <PensionContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        state={state}
        result={result}
      />
    </div>
  );
}
