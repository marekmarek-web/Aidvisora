"use client";

import { useRef, useEffect } from "react";
import { getCalculatedLtv } from "@/lib/calculators/mortgage/mortgage.engine";
import type { MortgageState } from "@/lib/calculators/mortgage/mortgage.types";

export interface MortgageContactModalProps {
  open: boolean;
  onClose: () => void;
  /** When opened from a bank card, the bank name; otherwise generic. */
  bankName: string | null;
  state: MortgageState;
  onSubmitSuccess?: () => void;
}

const FORMSUBMIT_URL = "https://formsubmit.co/ajax/kontakt@marek-marek.cz";

export function MortgageContactModal({
  open,
  onClose,
  bankName,
  state,
  onSubmitSuccess,
}: MortgageContactModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      backdropRef.current?.classList.remove("opacity-0");
      contentRef.current?.classList.remove("opacity-0", "scale-95");
      contentRef.current?.classList.add("scale-100");
    }, 10);
    return () => clearTimeout(t);
  }, [open]);

  const handleClose = () => {
    backdropRef.current?.classList.add("opacity-0");
    contentRef.current?.classList.remove("scale-100");
    contentRef.current?.classList.add("opacity-0", "scale-95");
    setTimeout(onClose, 300);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const originalHtml = submitBtn?.innerHTML ?? "";

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="animate-pulse">Odesílám...</span>';
    }

    const formData = new FormData(form);
    const ltv = getCalculatedLtv(state);
    const data: Record<string, string> = {
      ...Object.fromEntries(formData.entries()),
      _subject: `Poptávka: ${state.product === "mortgage" ? "Hypotéka" : "Úvěr"} – ${bankName ?? "Obecná poptávka"}`,
      banka: bankName ?? "Obecná poptávka",
      typ_produktu: state.product === "mortgage" ? "Hypotéka" : "Úvěr",
      typ_detail: state.product === "mortgage" ? state.mortgageType : state.loanType,
      vyse_uveru: String(state.loan),
      vlastni_zdroje: String(state.own),
      doba_splaceni: String(state.term),
      fixace: String(state.fix),
      ltv_akontace: String(ltv),
    };

    try {
      const res = await fetch(FORMSUBMIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        if (submitBtn) {
          submitBtn.classList.remove("bg-[#0a0f29]", "hover:bg-slate-900");
          submitBtn.classList.add("bg-green-600", "hover:bg-green-700");
          submitBtn.innerHTML = "Odesláno úspěšně";
        }
        setTimeout(() => {
          handleClose();
          form.reset();
          onSubmitSuccess?.();
          if (submitBtn) {
            setTimeout(() => {
              submitBtn.disabled = false;
              submitBtn.classList.add("bg-[#0a0f29]", "hover:bg-slate-900");
              submitBtn.classList.remove("bg-green-600", "hover:bg-green-700");
              submitBtn.innerHTML = originalHtml;
            }, 500);
          }
        }, 2000);
      } else {
        throw new Error("Chyba při odesílání");
      }
    } catch {
      if (submitBtn) {
        submitBtn.classList.remove("bg-[#0a0f29]", "hover:bg-slate-900");
        submitBtn.classList.add("bg-red-600", "hover:bg-red-700");
        submitBtn.innerHTML = "Chyba, zkuste to znovu";
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.classList.add("bg-[#0a0f29]", "hover:bg-slate-900");
          submitBtn.classList.remove("bg-red-600", "hover:bg-red-700");
          submitBtn.innerHTML = originalHtml;
        }, 3000);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-[#0a0f29]/80 backdrop-blur-sm transition-opacity opacity-0"
        onClick={handleClose}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={contentRef}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform scale-95 opacity-0 transition-all duration-300 pointer-events-auto relative overflow-hidden max-h-[90vh] overflow-y-auto"
          role="dialog"
          aria-modal
          aria-labelledby="mortgage-modal-title"
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-[#0a0f29] transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 z-10"
            aria-label="Zavřít"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="bg-gradient-to-r from-slate-50 to-white px-8 py-8 border-b border-slate-100">
            <h3 id="mortgage-modal-title" className="text-2xl font-bold text-[#0a0f29]">
              Mám zájem o nabídku
            </h3>
            <p className="text-sm text-slate-600 mt-2 flex items-center gap-2">
              <span className="text-[#fbbf24]">●</span>
              {bankName ? (
                <>
                  Vybraná banka: <strong className="text-[#0B3A7A]">{bankName}</strong>
                </>
              ) : (
                "Poptáváte srovnání všech bank"
              )}
            </p>
          </div>
          <div className="p-8">
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Jméno a příjmení <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Jan Novák"
                  className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-[#fbbf24] focus:border-transparent outline-none bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="vas@email.cz"
                  className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-[#fbbf24] focus:border-transparent outline-none bg-slate-50 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Telefon <span className="text-slate-400 font-normal">(nepovinné)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="+420 777 ..."
                  className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-[#fbbf24] outline-none bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="flex items-start gap-3 mt-2 bg-blue-50/50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  id="mortgage-consent"
                  name="consent"
                  required
                  className="mt-1 w-4 h-4 rounded border-slate-300 focus:ring-[#fbbf24] cursor-pointer"
                />
                <label htmlFor="mortgage-consent" className="text-xs text-slate-600 cursor-pointer select-none">
                  Souhlasím se zpracováním osobních údajů za účelem vytvoření nezávazné nabídky.
                </label>
              </div>
              <button
                type="submit"
                className="w-full mt-8 bg-[#0a0f29] hover:bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 text-lg"
              >
                <span>Odeslat poptávku</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
