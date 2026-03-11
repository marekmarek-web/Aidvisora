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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm min-h-[44px]">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Počet smluv</span>
        <div className="text-xl font-black text-slate-900">{data.contractCount}</div>
      </div>
      <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm min-h-[44px]">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Měsíční pojistné</span>
        <div className="text-xl font-black text-slate-900">{fmtCZK(data.totalMonthly)}</div>
      </div>
    </div>
  );
}
