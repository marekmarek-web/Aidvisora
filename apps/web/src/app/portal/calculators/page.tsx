import Link from "next/link";
import { TrendingUp } from "lucide-react";

export default function CalculatorsPage() {
  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Kalkulačky
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hypoteční, investiční a další kalkulačky pro poradce.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/portal/calculators/investment"
            className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white p-6 hover:border-[#fbbf24]/30 hover:shadow-lg transition-all flex flex-col items-center text-center gap-3 group"
          >
            <div className="w-14 h-14 rounded-full bg-[#0a0f29] text-white flex items-center justify-center group-hover:bg-[#fbbf24] transition-colors">
              <TrendingUp className="w-7 h-7" />
            </div>
            <h2 className="font-bold text-slate-900">Investiční kalkulačka</h2>
            <p className="text-sm text-slate-500">
              Projekce zhodnocení – výpočet hodnoty investice v čase podle strategie.
            </p>
          </Link>
          <div className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center text-center gap-3 opacity-75">
            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-slate-400 text-xl">⌛</span>
            </div>
            <h2 className="font-bold text-slate-600">Hypoteční kalkulačka</h2>
            <p className="text-sm text-slate-500">Připravuje se.</p>
          </div>
          <div className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center text-center gap-3 opacity-75">
            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-slate-400 text-xl">⌛</span>
            </div>
            <h2 className="font-bold text-slate-600">Další kalkulačky</h2>
            <p className="text-sm text-slate-500">Připravují se.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
