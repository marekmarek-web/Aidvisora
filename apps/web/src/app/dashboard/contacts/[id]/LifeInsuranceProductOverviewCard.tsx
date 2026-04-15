"use client";

import { useState, type ElementType, type ReactNode } from "react";
import type { CanonicalProduct } from "@/lib/client-portfolio/canonical-contract-read";
import { ChevronDown, ChevronRight, Building2, Shield, User } from "lucide-react";

function personRoleLabelCs(role: string): string {
  const m: Record<string, string> = {
    policyholder: "Pojistník",
    insured: "Pojištěný",
    beneficiary: "Oprávněná osoba",
    child: "Dítě",
    other: "Osoba",
  };
  return m[role] ?? "Osoba";
}

function AccordionRow({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon: ElementType;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)] min-h-[44px]"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0 text-indigo-500" aria-hidden />
          <span className="truncate">{title}</span>
        </span>
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
      </button>
      {open ? <div className="px-3 pb-3 pt-0 text-sm text-[color:var(--wp-text)] space-y-2 border-t border-[color:var(--wp-border-muted)]">{children}</div> : null}
    </div>
  );
}

export function LifeInsuranceProductOverviewCard({ product }: { product: CanonicalProduct }) {
  const d = product.segmentDetail;
  if (!d || d.kind !== "life_insurance") return null;

  const initial = (product.partnerName ?? product.productName ?? "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const prem =
    d.monthlyPremium != null
      ? `${d.monthlyPremium.toLocaleString("cs-CZ")} Kč`
      : product.premiumMonthly != null
        ? `${product.premiumMonthly.toLocaleString("cs-CZ")} Kč`
        : "—";

  return (
    <div className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3 mb-3">
        <div
          className="size-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black shrink-0"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-md bg-indigo-50 text-indigo-800 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 mb-1">
            Pojištění osob
          </span>
          <h3 className="font-bold text-[color:var(--wp-text)] leading-tight truncate">
            {product.productName ?? "Produkt neuveden"}
          </h3>
          <p className="text-sm text-[color:var(--wp-text-muted)] flex items-center gap-1.5 mt-0.5">
            <Building2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{d.insurer ?? product.partnerName ?? "—"}</span>
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Měsíční pojistné</dt>
          <dd className="font-bold text-[color:var(--wp-text)] tabular-nums">{prem}</dd>
        </div>
        {d.paymentFrequencyLabel ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Frekvence</dt>
            <dd>{d.paymentFrequencyLabel}</dd>
          </div>
        ) : null}
        {d.paymentAccountDisplay ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Účet pro běžné pojistné</dt>
            <dd className="font-mono text-xs break-all">{d.paymentAccountDisplay}</dd>
          </div>
        ) : null}
        {d.paymentVariableSymbol ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Variabilní symbol</dt>
            <dd className="font-mono tabular-nums">{d.paymentVariableSymbol}</dd>
          </div>
        ) : null}
        {product.contractNumber ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Číslo smlouvy</dt>
            <dd className="tabular-nums">{product.contractNumber}</dd>
          </div>
        ) : null}
        {d.extraPaymentAccountDisplay ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Účet pro mimořádné pojistné</dt>
            <dd className="font-mono text-xs break-all">{d.extraPaymentAccountDisplay}</dd>
          </div>
        ) : null}
      </dl>

      {(d.investmentStrategy || d.investmentPremiumLabel) && (
        <div className="mb-3 rounded-[var(--wp-radius)] border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900 mb-1">Investiční složka</p>
          {d.investmentStrategy ? <p className="text-emerald-950"><span className="text-emerald-800/80">Strategie: </span>{d.investmentStrategy}</p> : null}
          {d.investmentPremiumLabel ? <p className="text-emerald-950 mt-1"><span className="text-emerald-800/80">Investiční pojistné: </span>{d.investmentPremiumLabel}</p> : null}
        </div>
      )}

      <div className="space-y-2">
        {d.risks.length > 0 ? (
          <AccordionRow title="Rizika" icon={Shield} defaultOpen>
            <ul className="space-y-2">
              {d.risks.map((r, i) => (
                <li key={`${r.label}-${i}`} className="rounded-md bg-[color:var(--wp-surface-muted)] px-2 py-1.5">
                  <span className="font-medium">{r.label}</span>
                  {r.amount ? <span className="text-[color:var(--wp-text-muted)]"> · {r.amount}</span> : null}
                  {r.coverageEnd ? <span className="block text-xs text-[color:var(--wp-text-muted)]">Do {r.coverageEnd}</span> : null}
                  {r.monthlyRiskPremium ? (
                    <span className="block text-xs text-[color:var(--wp-text-muted)]">Měsíční rizikové: {r.monthlyRiskPremium}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </AccordionRow>
        ) : null}

        {d.persons.length > 0 ? (
          <AccordionRow title="Pojištěné osoby" icon={User}>
            <ul className="space-y-2">
              {d.persons.map((p, i) => (
                <li key={`${p.name ?? ""}-${i}`} className="rounded-md bg-[color:var(--wp-surface-muted)] px-2 py-1.5">
                  <span className="font-medium">{p.name ?? "—"}</span>
                  <span className="text-[color:var(--wp-text-muted)]"> · {personRoleLabelCs(p.role)}</span>
                  {p.birthDate ? <span className="block text-xs text-[color:var(--wp-text-muted)]">Nar.: {p.birthDate}</span> : null}
                  {p.personalId ? <span className="block text-xs text-[color:var(--wp-text-muted)]">RČ: {p.personalId}</span> : null}
                </li>
              ))}
            </ul>
          </AccordionRow>
        ) : null}
      </div>
    </div>
  );
}
