"use client";

import { useState, useEffect } from "react";
import { getFinancialSummary } from "@/app/actions/financial";

function fmtCZK(value: number): string {
  if (value === 0) return "—";
  return value.toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " Kč";
}

export function ContactOverviewKpi({ contactId }: { contactId: string }) {
  const [data, setData] = useState<{ totalMonthly: number; contractCount: number } | null>(null);

  useEffect(() => {
    getFinancialSummary(contactId)
      .then((s) => {
        const contractCount = s.bySegment.reduce((acc, seg) => acc + seg.count, 0);
        if (contractCount === 0 && s.totalMonthly === 0) {
          setData(null);
          return;
        }
        setData({ totalMonthly: s.totalMonthly, contractCount });
      })
      .catch(() => setData(null));
  }, [contactId]);

  if (!data) return null;

  return (
    <div className="flex flex-wrap gap-4">
      <div className="rounded-[var(--wp-radius)] border border-slate-200 bg-white px-4 py-3 shadow-sm min-h-[44px] flex items-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2">Počet smluv</span>
        <span className="text-lg font-bold text-slate-800">{data.contractCount}</span>
      </div>
      <div className="rounded-[var(--wp-radius)] border border-slate-200 bg-white px-4 py-3 shadow-sm min-h-[44px] flex items-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2">Měsíční pojistné</span>
        <span className="text-lg font-bold text-slate-800">{fmtCZK(data.totalMonthly)}</span>
      </div>
    </div>
  );
}
