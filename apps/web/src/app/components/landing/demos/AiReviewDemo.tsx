"use client";

import React from "react";
import {
  CheckCircle2,
  CheckCheck,
  FileText,
  Loader2,
  Sparkles,
  User,
  Building2,
  CreditCard,
  Wallet,
} from "lucide-react";
import { LandingProductFrame } from "./LandingProductFrame";
import { LandingInstitutionLogo } from "./LandingInstitutionLogo";
import { useInViewTrigger, prefersReducedMotion } from "./landing-in-view";

type Phase = "idle" | "scanning" | "result" | "approved";

/**
 * AI Review demo — split view ve stylu skutečného `AIReviewExtractionShell`:
 * vlevo stylizovaný PDF náhled, vpravo extrahovaná pole.
 *
 * Flow: auto-start při scrollu do viewportu → 1.2 s loading → výsledek.
 * Respektuje prefers-reduced-motion (rovnou zobrazí výsledek).
 */
export function AiReviewDemo() {
  const { ref, inView } = useInViewTrigger<HTMLDivElement>();
  const [phase, setPhase] = React.useState<Phase>("idle");

  React.useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setPhase("result");
      return;
    }
    const t1 = window.setTimeout(() => setPhase("scanning"), 450);
    const t2 = window.setTimeout(() => setPhase("result"), 2100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [inView]);

  const reset = () => {
    setPhase("idle");
    window.setTimeout(() => setPhase("scanning"), 200);
    window.setTimeout(() => setPhase("result"), 1700);
  };

  const approve = () => {
    setPhase("approved");
  };

  return (
    <div ref={ref}>
      <LandingProductFrame
        label="AI review · Smlouva_o_ZP_2026.pdf"
        status={
          phase === "approved" ? "propsáno" : phase === "result" ? "připraveno ke schválení" : phase === "scanning" ? "běží" : "připraveno"
        }
        statusTone={phase === "approved" ? "emerald" : phase === "result" ? "indigo" : phase === "scanning" ? "amber" : "slate"}
      >
        <div className="grid min-h-[480px] grid-cols-1 md:grid-cols-[1.1fr_1fr]">
          {/* PDF preview */}
          <div className="relative overflow-hidden border-b border-white/10 bg-[#0a0f29]/60 p-5 md:border-b-0 md:border-r md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-20" aria-hidden />
            <div
              className={`relative mx-auto aspect-[3/4] max-w-[320px] overflow-hidden rounded-2xl bg-[#f8fafc] p-5 text-slate-900 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] transition-all ${
                phase === "approved" ? "scale-[0.98] blur-[1.5px]" : ""
              }`}
            >
              <div className="mb-4 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-400">
                <span>Smlouva č. GCP-2026-004821</span>
                <FileText size={12} />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Pojistník</div>
                  <div className="text-[11px] font-bold text-slate-800">Jana Nováková</div>
                  <div className="text-[9px] text-slate-500">Praha · r. č. ***</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Produkt</div>
                  <div className="text-[11px] text-slate-800">Rezervotvorné životní pojištění</div>
                </div>
                <div>
                  <div className="mb-1 text-[9px] font-bold uppercase text-slate-400">Instituce</div>
                  <div className="flex items-center gap-2">
                    <LandingInstitutionLogo institution="Generali Česká pojišťovna" brand="generali" size="sm" />
                    <span className="text-[11px] font-semibold text-slate-800">Generali Česká pojišťovna</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Pojistné</div>
                    <div className="text-[11px] font-bold text-slate-800">1 850 Kč / měs.</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Počátek</div>
                    <div className="text-[11px] text-slate-800">01. 03. 2026</div>
                  </div>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="h-1.5 w-full rounded bg-slate-200" />
                  <div className="h-1.5 w-[92%] rounded bg-slate-200" />
                  <div className="h-1.5 w-[78%] rounded bg-slate-200" />
                  <div className="h-1.5 w-[85%] rounded bg-slate-200" />
                </div>
                <div className="pt-1">
                  <div className="text-[9px] uppercase font-bold text-slate-400 mb-1">Platební údaje</div>
                  <div className="text-[10px] text-slate-700">Účet: 2400123456 / 2010</div>
                  <div className="text-[10px] text-slate-700">VS: 4821004821</div>
                </div>
              </div>

              {phase === "scanning" && !prefersReducedMotion() ? (
                <div
                  className="absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-indigo-400/30 to-transparent pointer-events-none"
                  style={{ animation: "aidv-scan 1.4s ease-in-out infinite", top: 0 }}
                  aria-hidden
                />
              ) : null}

              {phase === "result" || phase === "approved" ? (
                <div className="absolute inset-0 bg-emerald-500/5 ring-2 ring-emerald-400/40 rounded-2xl pointer-events-none" aria-hidden />
              ) : null}
            </div>

            {phase === "approved" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f29]/35 backdrop-blur-sm">
                <div className="rounded-[26px] border border-emerald-400/35 bg-emerald-500/15 px-5 py-4 text-center shadow-[0_20px_50px_-20px_rgba(16,185,129,0.6)]">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-100">
                    <CheckCheck size={14} /> Úspěšně propsáno
                  </div>
                  <p className="text-sm font-semibold text-white">Smlouva byla propsána do Aidvisory.</p>
                </div>
              </div>
            ) : null}

            <style>{`
              @keyframes aidv-scan {
                0% { transform: translateY(0); opacity: 0.2; }
                50% { opacity: 0.9; }
                100% { transform: translateY(440px); opacity: 0.2; }
              }
              @media (prefers-reduced-motion: reduce) {
                [style*="aidv-scan"] { animation: none !important; }
              }
            `}</style>
          </div>

          {/* Extraction panel */}
          <div className="relative flex min-h-[480px] flex-col p-5 md:p-6">
            {phase === "idle" || phase === "scanning" ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  {phase === "scanning" ? (
                    <Loader2 size={22} className="text-indigo-300 animate-spin" />
                  ) : (
                    <Sparkles size={22} className="text-slate-400" />
                  )}
                </div>
                <p className="text-sm font-semibold text-white mb-1">
                  {phase === "scanning" ? "Čtu dokument a vytahuji pole…" : "AI review připravená"}
                </p>
                <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                  {phase === "scanning"
                    ? "Rozpoznávám klienta, produkt, částky a platební údaje."
                    : "Demo se spustí automaticky, jakmile se sekce objeví v zobrazení."}
                </p>
              </div>
            ) : (
              <div
                className={`flex flex-1 flex-col gap-3 animate-in fade-in duration-300 transition-all ${
                  phase === "approved" ? "blur-[1.5px] opacity-70" : ""
                }`}
              >
                <FieldRow icon={User} label="Klient" value="Jana Nováková" />
                <FieldRow icon={FileText} label="Typ produktu" value="Životní pojištění (IŽP)" />
                <FieldRow icon={Wallet} label="Pojistné" value="1 850 Kč měsíčně" />
                <FieldRow
                  icon={Building2}
                  label="Instituce"
                  value="Generali Česká pojišťovna"
                  logo={<LandingInstitutionLogo institution="Generali Česká pojišťovna" brand="generali" size="sm" />}
                />
                <FieldRow icon={CreditCard} label="Platební údaje" value="2400123456 / 2010 · VS 4821004821" />

                <div className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-300 mb-1.5">
                    <Sparkles size={12} /> Návrh akcí
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      Založit klienta · přiřadit ke kontaktu
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      Propsat smlouvu do karty klienta
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      Vytvořit úkol: ověřit krytí invalidity
                    </li>
                  </ul>
                </div>

                <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Spustit znovu
                  </button>
                  <button
                    type="button"
                    onClick={approve}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-200 transition-colors hover:bg-emerald-500/25"
                  >
                    <CheckCircle2 size={14} /> Schválit do Aidvisory
                  </button>
                </div>
              </div>
            )}

            {phase === "approved" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#060918]/25 backdrop-blur-sm">
                <div className="max-w-[280px] rounded-3xl border border-emerald-400/35 bg-[#0b1438]/85 p-5 text-center shadow-[0_20px_50px_-20px_rgba(16,185,129,0.7)]">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-100">
                    <CheckCheck size={14} /> Propsáno
                  </div>
                  <p className="mb-1 text-sm font-semibold text-white">Úspěšně propsáno do Aidvisory</p>
                  <p className="text-xs leading-relaxed text-slate-300">
                    Klient, instituce, pojistné i platební údaje byly přeneseny do karty klienta.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </LandingProductFrame>
    </div>
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  logo,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  logo?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-slate-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-0.5">{label}</div>
        {logo ? (
          <div className="flex items-center gap-2">
            {logo}
            <div className="text-sm font-medium break-words text-white">{value}</div>
          </div>
        ) : (
          <div className="text-sm font-medium break-words text-white">{value}</div>
        )}
      </div>
    </div>
  );
}

export default AiReviewDemo;
