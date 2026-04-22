"use client";

import { useState } from "react";
import { FileText, UploadCloud } from "lucide-react";

/**
 * Perf — AiSandbox je below-the-fold interaktivní demo. Dříve byl inline
 * v monolitické `PremiumLandingPage.tsx` (2300 řádek), teď je vlastní modul,
 * který landing lazy-loaduje přes `next/dynamic` s `ssr: false`. Tím:
 *   - komponenta není v initial HTML (SEO je krytý statickým heroem nad ní),
 *   - její hydratace přijde jako samostatný chunk až když je potřeba,
 *   - initial JS bundle landing page je o ~3 KB gzip menší.
 */
export function AiSandbox() {
  const [status, setStatus] = useState<"idle" | "scanning" | "result">("idle");

  const handleDemo = () => {
    setStatus("scanning");
    setTimeout(() => setStatus("result"), 2500);
  };

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-3 text-xs sm:text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-200 text-right font-medium break-words">{value}</span>
    </div>
  );

  return (
    <div className="aspect-[4/5] md:aspect-square max-w-[500px] mx-auto bg-[#060918]/80 backdrop-blur-xl rounded-[32px] border border-white/10 shadow-[0_0_50px_rgba(168,85,247,0.15)] p-5 md:p-6 relative overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300 font-jakarta tracking-wide">AI review · ukázka</span>
        </div>
        <div className="flex gap-1.5 opacity-50">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-0 relative">
        {status === "idle" && (
          <div className="text-center animate-in fade-in zoom-in duration-300 px-1">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
              <FileText size={28} className="text-slate-400" />
            </div>
            <h4 className="text-white font-bold mb-2 text-[15px]">Vyzkoušejte AI review smlouvy</h4>
            <p className="text-sm text-slate-400 mb-7 max-w-[280px] mx-auto leading-relaxed">
              Kliknutím spustíte ukázkové zpracování PDF dokumentu.
            </p>
            <button
              type="button"
              onClick={handleDemo}
              className="min-h-[44px] px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-all active:scale-[0.98] flex items-center gap-2 mx-auto"
            >
              <UploadCloud size={16} /> Nahrát ukázkovou smlouvu
            </button>
          </div>
        )}

        {status === "scanning" && (
          <div className="flex flex-col items-center justify-center animate-in fade-in duration-300 px-4 py-8">
            <p className="text-sm text-slate-300 text-center animate-pulse">Čtu dokument…</p>
          </div>
        )}

        {status === "result" && (
          <div className="animate-in fade-in duration-300 flex flex-col min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 -mr-1 space-y-3 text-left">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Review dokumentu</p>
              <p className="text-sm font-medium text-white truncate" title="Smlouva_o_ZP_2026.pdf">
                Smlouva_o_ZP_2026.pdf
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500">Stav:</span>
                <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded">extracted</span>
                <span className="text-[11px] text-slate-600">·</span>
                <span className="text-[11px] font-mono text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded">pending</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Rozpoznané údaje</p>
              <div className="space-y-2 pt-0.5">
                {row("Instituce", "Pojišťovna XY (ukázka)")}
                {row("Typ produktu", "životní pojištění")}
                {row("Klient", "Jan Novák")}
                {row("Číslo smlouvy", "ZP-2026-004821")}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">Vyžaduje kontrolu</p>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside marker:text-amber-500/60">
                <li>chybí e-mail</li>
                <li>chybí telefon</li>
                <li>ověřit přiřazení ke klientovi</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Návrhové akce</p>
              <ul className="text-xs text-slate-400 space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-purple-400/60 shrink-0" />
                  Vytvořit klienta
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-purple-400/60 shrink-0" />
                  Vytvořit smlouvu v Aidvisoře
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-purple-400/60 shrink-0" />
                  Úkol ze smlouvy
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-1 pb-1">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-[40px] flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                >
                  Otevřít detail
                </button>
                <button
                  type="button"
                  className="min-h-[40px] flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 transition-colors"
                >
                  Schválit
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="text-center text-[11px] text-slate-500 hover:text-slate-400 py-2 transition-colors"
              >
                Spustit ukázku znovu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AiSandbox;
