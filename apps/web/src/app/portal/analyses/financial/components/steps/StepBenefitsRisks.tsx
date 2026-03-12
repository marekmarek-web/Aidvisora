"use client";

import { useFinancialAnalysisStore as useStore } from "@/lib/analyses/financial/store";
import type { CompanyRisks } from "@/lib/analyses/financial/types";
import { formatCzk } from "@/lib/analyses/financial/formatters";
import { Gift, ShieldAlert } from "lucide-react";

const RISK_LABELS: { key: keyof CompanyRisks; label: string }[] = [
  { key: "property", label: "Majetek" },
  { key: "interruption", label: "Přerušení provozu" },
  { key: "liability", label: "Odpovědnost" },
  { key: "director", label: "D&O (ředitelé)" },
  { key: "fleet", label: "Flotila" },
  { key: "cyber", label: "Kyber" },
];

export function StepBenefitsRisks() {
  const data = useStore((s) => s.data);
  const setData = useStore((s) => s.setData);
  const benefits = data.companyBenefits ?? {};
  const risks = data.companyRisks ?? {};

  const setBenefits = (patch: Partial<typeof benefits>) => {
    const next = { ...benefits, ...patch };
    const amountPerPerson = next.amountPerPerson ?? 0;
    const employeeCount = next.employeeCount ?? 0;
    const directorsAmount = next.directorsAmount ?? 0;
    next.annualCost = (amountPerPerson * employeeCount + directorsAmount) * 12;
    setData({ companyBenefits: next });
  };
  const setRisks = (patch: Partial<typeof risks>) => {
    setData({ companyRisks: { ...risks, ...patch } });
  };

  const riskCount = RISK_LABELS.filter((r) => risks[r.key]).length;
  const riskRecommendation =
    riskCount >= 5 ? "Dobré pokrytí rizik." : riskCount >= 3 ? "Doporučujeme doplnit další kategorie pojištění." : "Zvažte rozšíření pojištění firmy.";

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Benefity & Rizika</h2>
        <p className="text-slate-500 mt-1">Firemní benefity a pojištění firmy – rizika a doporučení.</p>
      </div>

      <div className="space-y-8">
        <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-indigo-600" />
            Benefity
          </h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {[
                { key: "dps" as const, label: "DPS" },
                { key: "dip" as const, label: "DIP" },
                { key: "izp" as const, label: "IŽP" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={!!benefits[key]}
                    onChange={(e) => setBenefits({ [key]: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
                  />
                  <span className="font-semibold text-slate-700">{label}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Příspěvek na osobu (Kč/měsíc)</label>
                <input
                  type="number"
                  min={0}
                  value={benefits.amountPerPerson ?? ""}
                  onChange={(e) => setBenefits({ amountPerPerson: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Počet zaměstnanců</label>
                <input
                  type="number"
                  min={0}
                  value={benefits.employeeCount ?? ""}
                  onChange={(e) => setBenefits({ employeeCount: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Příspěvky jednatelům (Kč/měsíc)</label>
                <input
                  type="number"
                  min={0}
                  value={benefits.directorsAmount ?? ""}
                  onChange={(e) => setBenefits({ directorsAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Roční náklad (odhad)</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{formatCzk(benefits.annualCost ?? 0)}</div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            Pojištění firmy (rizika)
          </h3>
          <p className="text-sm text-slate-600 mb-4">Zaškrtněte kategorie, které má firma pokryté.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RISK_LABELS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 cursor-pointer min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={!!risks[key]}
                  onChange={(e) => setRisks({ [key]: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
                />
                <span className="font-semibold text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-xl bg-white border border-slate-200">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Pokrytí rizik</span>
                <div className="text-2xl font-bold text-slate-900">{riskCount}/6</div>
              </div>
              <p className="text-sm text-slate-600 flex-1">{riskRecommendation}</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
