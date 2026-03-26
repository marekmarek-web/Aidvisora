"use client";

import { useCompanyFaStore } from "@/lib/analyses/company-fa/store";
import { step2Kpi, INFLATION_RATE } from "@/lib/analyses/company-fa/calculations";

function num(v: unknown, def: number): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") return parseInt(v, 10) || def;
  return def;
}

export function StepCompanyFinance() {
  const payload = useCompanyFaStore((s) => s.payload);
  const setFinance = useCompanyFaStore((s) => s.setFinance);
  const finance = payload.finance ?? {};
  const kpi = step2Kpi(payload);

  return (
    <section className="p-4 md:p-6 bg-[color:var(--wp-surface-card)] rounded-xl border border-[color:var(--wp-surface-card-border)]">
      <h3 className="text-lg font-medium text-[color:var(--wp-text)] mb-4">Finance</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label>
          <span className="block text-sm font-medium text-[color:var(--wp-text-secondary)] mb-1">Roční tržby (Kč)</span>
          <input
            type="number"
            min={0}
            value={finance.revenue ?? 0}
            onChange={(e) => setFinance({ revenue: num(e.target.value, 0) })}
            className="w-full rounded-lg border border-[color:var(--wp-border-strong)] px-3 py-2 text-[color:var(--wp-text)]"
          />
        </label>
        <label>
          <span className="block text-sm font-medium text-[color:var(--wp-text-secondary)] mb-1">Roční zisk / EBITDA (Kč)</span>
          <input
            type="number"
            value={finance.profit ?? 0}
            onChange={(e) => setFinance({ profit: num(e.target.value, 0) })}
            className="w-full rounded-lg border border-[color:var(--wp-border-strong)] px-3 py-2 text-[color:var(--wp-text)]"
          />
        </label>
        <label>
          <span className="block text-sm font-medium text-[color:var(--wp-text-secondary)] mb-1">Rezerva (Kč)</span>
          <input
            type="number"
            min={0}
            value={finance.reserve ?? 0}
            onChange={(e) => setFinance({ reserve: num(e.target.value, 0) })}
            className="w-full rounded-lg border border-[color:var(--wp-border-strong)] px-3 py-2 text-[color:var(--wp-text)]"
          />
        </label>
        <label>
          <span className="block text-sm font-medium text-[color:var(--wp-text-secondary)] mb-1">Měsíční splátka úvěrů (Kč)</span>
          <input
            type="number"
            min={0}
            value={finance.loanPayment ?? 0}
            onChange={(e) => setFinance({ loanPayment: num(e.target.value, 0) })}
            className="w-full rounded-lg border border-[color:var(--wp-border-strong)] px-3 py-2 text-[color:var(--wp-text)]"
          />
        </label>
      </div>
      <div className="mt-4 p-3 bg-[color:var(--wp-surface-muted)] rounded-lg border border-[color:var(--wp-surface-card-border)] space-y-1">
        <p className="text-sm text-[color:var(--wp-text-secondary)]">
          <strong>Měsíční náklady (odhad):</strong> {kpi.monthlyExp.toLocaleString("cs-CZ")} Kč
        </p>
        <p className="text-sm text-[color:var(--wp-text-secondary)]">
          <strong>Dluhová služba (rok):</strong> {(kpi.yearlyLoanService ?? finance.loanPayment * 12).toLocaleString("cs-CZ")} Kč
        </p>
        <p className="text-sm text-[color:var(--wp-text-secondary)]">
          <strong>Cash runway:</strong> {kpi.runway} měsíců
        </p>
        {kpi.inflationLoss > 1000 && (
          <p className="text-sm text-amber-700">
            Inflační ztráta na rezervě ({(INFLATION_RATE * 100).toFixed(1)} %): cca{" "}
            {kpi.inflationLoss.toLocaleString("cs-CZ")} Kč/rok.
          </p>
        )}
      </div>
    </section>
  );
}
