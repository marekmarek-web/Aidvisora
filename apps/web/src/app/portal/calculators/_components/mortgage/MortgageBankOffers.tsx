"use client";

import { formatCurrency, formatRate } from "@/lib/calculators/mortgage/formatters";
import type { BankOffer } from "@/lib/calculators/mortgage/mortgage.types";

export interface MortgageBankOffersProps {
  offers: BankOffer[];
  /** Optional: when provided, "Chci nabídku" button is shown (web/lead mode). */
  onRequestOffer?: (bankName: string) => void;
}

function fallbackLogoUrl(bankId: string): string {
  return `https://placehold.co/100x30/1e293b/ffffff?text=${encodeURIComponent(bankId.toUpperCase())}`;
}

export function MortgageBankOffers({
  offers,
  onRequestOffer,
}: MortgageBankOffersProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-slate-900 mb-4">
        Nabídky bank
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {offers.map((offer, index) => (
          <div
            key={offer.bank.id}
            className="animate-fade-in bg-white border border-slate-200 rounded-[var(--wp-radius-sm)] shadow-sm p-5 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-all"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="relative w-[100px] h-8 flex items-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={offer.bank.logoUrl}
                alt=""
                className="max-w-[100px] max-h-8 object-contain object-left"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  if (t) t.src = fallbackLogoUrl(offer.bank.id);
                }}
              />
            </div>
            <div className="flex-1 flex flex-row justify-between w-full md:w-auto items-center gap-4">
              <div className="text-center md:text-left">
                <div className="text-xs text-slate-400 font-semibold uppercase">
                  Úrok
                </div>
                <div className="font-bold text-slate-900 text-lg">
                  {formatRate(offer.rate)}
                </div>
              </div>
              <div className="text-center md:text-right">
                <div className="text-xs text-slate-400 font-semibold uppercase">
                  Měsíčně
                </div>
                <div className="font-bold text-xl text-slate-900">
                  {formatCurrency(offer.monthlyPayment)} Kč
                </div>
              </div>
            </div>
            {onRequestOffer != null && (
              <button
                type="button"
                onClick={() => onRequestOffer(offer.bank.name)}
                className="min-h-[44px] w-full md:w-auto bg-gradient-to-r from-[#fbbf24] to-[#fde047] hover:from-[#fde047] hover:to-[#fbbf24] text-[#0a0f29] font-bold py-2 px-6 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                Chci nabídku
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
