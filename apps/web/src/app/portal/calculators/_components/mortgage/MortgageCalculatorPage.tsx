"use client";

import { useMemo, useState, useCallback } from "react";
import { CalculatorPageShell } from "../core/CalculatorPageShell";
import { CalculatorHero } from "../core/CalculatorHero";
import { CalculatorInputSection } from "../core/CalculatorInputSection";
import { CalculatorResultsSection } from "../core/CalculatorResultsSection";
import { CalculatorCtaBlock } from "../core/CalculatorCtaBlock";
import { MortgageProductSwitcher } from "./MortgageProductSwitcher";
import { MortgageTabSwitcher } from "./MortgageTabSwitcher";
import { MortgageInputPanel } from "./MortgageInputPanel";
import { MortgageResultsPanel } from "./MortgageResultsPanel";
import { MortgageBankOffers } from "./MortgageBankOffers";
import { MortgageContactModal } from "./MortgageContactModal";
import { MortgageCtaCards } from "./MortgageCtaCards";
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

  const [modalOpen, setModalOpen] = useState(false);
  const [modalBankName, setModalBankName] = useState<string | null>(null);

  const result = useMemo(() => calculateResult(state), [state]);
  const offers = useMemo(() => getOffers(state), [state]);

  const onCtaClick = useCallback(() => {
    setModalBankName(null);
    setModalOpen(true);
  }, []);

  const onRequestOffer = useCallback((bankName: string) => {
    setModalBankName(bankName);
    setModalOpen(true);
  }, []);

  return (
    <div className="pt-0">
      <section className="bg-[#EAF3FF] pt-28 pb-[280px] px-4 md:py-20 md:pb-10 lg:pt-32">
        <CalculatorPageShell maxWidth="max-w-7xl" className="mb-10">
          <CalculatorHero
            title={
              <>
                Kalkulačka hypoték a úvěrů
                <br />
                <span className="text-[#fbbf24]">Srovnání bez kontaktu</span>
              </>
            }
            subtitle="Spočítejte si měsíční splátku hypotéky nebo úvěru. Porovnejte nabídky bank a požádejte o nezávaznou nabídku."
            badge={
              <div className="bg-white rounded-xl py-4 px-6 shadow-lg flex flex-col items-center justify-center text-center gap-1">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Odhad úroku
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-extrabold text-4xl text-[#0a0f29]">
                    {result.finalRate.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="font-bold text-xl text-[#fbbf24]">% p.a.</span>
                </div>
              </div>
            }
          >
            <div className="flex flex-col gap-4">
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
          </CalculatorHero>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-10">
            <CalculatorInputSection>
              <MortgageInputPanel
                state={state}
                onStateChange={setState}
              />
            </CalculatorInputSection>
            <CalculatorResultsSection>
              <div className="hidden lg:block sticky top-24">
                <MortgageResultsPanel result={result} onCtaClick={onCtaClick} />
              </div>
            </CalculatorResultsSection>
          </div>

          <div className="mt-12 w-full">
            <MortgageBankOffers offers={offers} onRequestOffer={onRequestOffer} />
          </div>

          <CalculatorCtaBlock
            title="Chcete nezávaznou nabídku na míru?"
            description="Na základě vašich parametrů vám sestavíme srovnání nabídek od bank. Bez závazku a zdarma."
            cta={
              <button
                type="button"
                onClick={onCtaClick}
                className="group relative inline-block w-full sm:w-auto bg-gradient-to-r from-[#fbbf24] to-[#fde047] hover:to-[#fbbf24] text-[#0a0f29] font-extrabold py-5 px-8 rounded-xl shadow-lg shadow-[#fbbf24]/30 transition-all transform hover:scale-[1.02] overflow-hidden text-center"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-white/30 skew-x-[-20deg] animate-shimmer" />
                <div className="relative flex items-center justify-center gap-3 text-lg uppercase tracking-wider">
                  Chci nezávaznou nabídku
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </button>
            }
          />

          <MortgageCtaCards />
        </CalculatorPageShell>
      </section>

      {/* Mobile: floating result card at bottom (touch-friendly) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-[420px] mx-auto pointer-events-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
          <MortgageResultsPanel result={result} onCtaClick={onCtaClick} />
        </div>
      </div>

      <MortgageContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        bankName={modalBankName}
        state={state}
      />
    </div>
  );
}
