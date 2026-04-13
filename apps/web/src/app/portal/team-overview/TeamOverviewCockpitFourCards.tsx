"use client";

import { Users, TrendingUp, ShieldAlert, GraduationCap } from "lucide-react";
import type { TeamOverviewKpis } from "@/app/actions/team-overview";
export function TeamOverviewCockpitFourCards({
  kpis,
  inProductionCount,
  loading,
}: {
  kpis: TeamOverviewKpis | null;
  inProductionCount: number;
  loading: boolean;
}) {
  if (loading && !kpis) {
    return <div className="h-28 animate-pulse rounded-[28px] bg-slate-200/80" />;
  }
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
          <Users className="h-4 w-4 text-slate-400" />
          Velikost týmu
        </div>
        <p className="text-[34px] font-black leading-none tracking-tight text-[#16192b]">{kpis.memberCount}</p>
      </div>
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Aktivní produkce
        </div>
        <p className="text-[34px] font-black leading-none tracking-tight text-emerald-600">{inProductionCount}</p>
        <p className="mt-1 text-[10px] font-medium text-slate-400">Členové s produkcí &gt; 0</p>
      </div>
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          Krizový zásah
        </div>
        <p
          className={`text-[34px] font-black leading-none tracking-tight ${kpis.riskyMemberCount > 0 ? "text-rose-500" : "text-emerald-600"}`}
        >
          {kpis.riskyMemberCount}
        </p>
        <p className="mt-1 text-[10px] font-medium text-slate-400">Signály rizika (CRM)</p>
      </div>
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
          <GraduationCap className="h-4 w-4 text-blue-600" />
          Nováčci v adaptaci
        </div>
        <p className="text-[34px] font-black leading-none tracking-tight text-blue-600">{kpis.newcomersInAdaptation}</p>
      </div>
    </div>
  );
}
