"use client";

import { useMemo, useState, useCallback } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorHero } from "../core/CalculatorHero";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { CalculatorInfoCard } from "../core/CalculatorInfoCard";
import { CalculatorChartCard } from "../core/CalculatorChartCard";
import { CalculatorCtaBlock } from "../core/CalculatorCtaBlock";
import { CalculatorFaqSection } from "../core/CalculatorFaqSection";
import { LifeInputPanel } from "./LifeInputPanel";
import { LifeResultsPanel } from "./LifeResultsPanel";
import { LifeRiskChart } from "./LifeRiskChart";
import { LifeContactModal } from "./LifeContactModal";
import { LifeCtaCards } from "./LifeCtaCards";
import { DEFAULT_STATE } from "@/lib/calculators/life/life.config";
import { LIFE_FAQ } from "@/lib/calculators/life/life.config";
import { runCalculations } from "@/lib/calculators/life/life.engine";
import type { LifeState } from "@/lib/calculators/life/life.types";
import type { LifeModalType } from "./LifeContactModal";
import { HeartPulse } from "lucide-react";

export function LifeCalculatorPage() {
  const [state, setState] = useState<LifeState>({ ...DEFAULT_STATE });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<LifeModalType>("general");

  const result = useMemo(() => runCalculations(state), [state]);

  const onCtaPrimary = useCallback(() => {
    setModalType("general");
    setModalOpen(true);
  }, []);

  const onCtaCheck = useCallback(() => {
    setModalType("check");
    setModalOpen(true);
  }, []);

  const onCtaProposal = useCallback(() => {
    setModalType("proposal");
    setModalOpen(true);
  }, []);

  return (
    <div className="pt-0">
      <section className="bg-[#EAF3FF] pt-28 pb-[280px] px-4 md:py-20 md:pb-10 lg:pt-32">
        <CalculatorPageShell maxWidth="max-w-7xl" className="mb-10">
          <CalculatorHero
            title={
              <>
                Kalkulačka životního pojištění –
                <br />
                <span className="text-[#fbbf24]">
                  výpočet potřebného krytí
                </span>
              </>
            }
            subtitle="Spočítejte si orientačně, jaké krytí životního pojištění dává smysl podle příjmu, výdajů a závazků. Výsledek vysvětlím a navrhnu další postup. Telefon je volitelný."
            badge={
              <div className="bg-white rounded-xl py-4 px-6 shadow-lg flex flex-col items-center justify-center text-center gap-1">
                <HeartPulse className="w-8 h-8 text-[#fbbf24] mx-auto" />
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Analýza potřeb
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
                  Tato kalkulačka slouží k orientačnímu výpočtu potřebného krytí
                  životního pojištění na základě vašich příjmů, výdajů a
                  závazků. Pomáhá získat základní přehled o tom, jaká pojistná
                  ochrana může dávat smysl v konkrétní životní situaci.
                </p>
                <p>
                  Výpočet zohledňuje zejména zajištění příjmů rodiny, závazky
                  jako je hypotéka a délku ekonomické aktivity.
                </p>
                <p>
                  Výsledné částky nejsou nabídkou pojištění, ale orientačním
                  doporučením.
                </p>
                <p>
                  Každá situace je individuální a finální nastavení se vždy
                  řeší po osobní nebo online konzultaci, kde se vysvětlí
                  jednotlivé možnosti a jejich dopad.
                </p>
              </>
            </CalculatorInfoCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-10">
            <CalculatorInputSection>
              <LifeInputPanel state={state} onStateChange={setState} />
            </CalculatorInputSection>
            <CalculatorResultsSection>
              <div className="hidden lg:block sticky top-24">
                <LifeResultsPanel
                  state={state}
                  result={result}
                  onCtaPrimary={onCtaPrimary}
                  onCtaCheck={onCtaCheck}
                />
              </div>
            </CalculatorResultsSection>
          </div>

          <div className="mt-12 hidden md:block">
            <CalculatorChartCard
              title="Analýza rizika (Měsíční bilance)"
              icon={
                <span className="text-[#fbbf24] text-sm font-bold uppercase">
                  Graf
                </span>
              }
              caption="Graf znázorňuje propad příjmů v případě nemoci nebo invalidity a částku, kterou je třeba dokrýt. Oranžová část představuje finanční mezeru, kterou stát nepokryje a je nutné ji zajistit z vlastních zdrojů nebo pojištění."
            >
              <LifeRiskChart chartData={result.chartData} />
            </CalculatorChartCard>
          </div>

          <CalculatorFaqSection
            title="FAQ – Kalkulačka životního pojištění"
            items={LIFE_FAQ}
          />

          <CalculatorCtaBlock
            title="Chcete konkrétní návrh životního pojištění?"
            description="Výsledek z kalkulačky slouží jako orientační výpočet. Rád vám jej vysvětlím a navrhnu řešení odpovídající vaší konkrétní situaci. Telefon je volitelný."
            cta={
              <button
                type="button"
                onClick={onCtaProposal}
                className="group relative inline-flex items-center gap-3 bg-[#fbbf24] hover:bg-[#fde047] text-[#0a0f29] font-bold py-4 px-8 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 min-h-[44px]"
              >
                Chci návrh životního pojištění
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

          <LifeCtaCards />
        </CalculatorPageShell>
      </section>

      {/* Mobile: floating result card at bottom */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-[420px] mx-auto pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
          <LifeResultsPanel
            state={state}
            result={result}
            onCtaPrimary={onCtaPrimary}
            onCtaCheck={onCtaCheck}
          />
        </div>
      </div>

      <LifeContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        state={state}
        result={result}
      />
    </div>
  );
}
