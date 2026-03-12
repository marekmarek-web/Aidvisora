"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, PlusCircle, BarChart3, FileSpreadsheet } from "lucide-react";
import type { FinancialAnalysisListItem } from "@/app/actions/financial-analyses";

function formatUpdated(updatedAt: Date): string {
  const d = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Dnes";
  if (diffDays === 1) return "Včera";
  if (diffDays < 7) return `Před ${diffDays} dny`;
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
}

export function AnalysesPageClient({ analyses }: { analyses: FinancialAnalysisListItem[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return analyses;
    const q = searchQuery.trim().toLowerCase();
    return analyses.filter((a) => (a.clientName ?? "").toLowerCase().includes(q));
  }, [analyses, searchQuery]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Page header – same pattern as Contacts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3 flex-wrap">
            Finanční analýzy
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg border border-slate-200">
              {filteredList.length === analyses.length ? `${analyses.length} celkem` : `${filteredList.length} / ${analyses.length}`}
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Uložené analýzy a nástroje pro doporučení.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/portal/analyses/financial"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c2e] text-white rounded-[var(--wp-radius-sm)] text-xs font-bold uppercase tracking-wide shadow-md hover:bg-[#2a2d4a] transition-all hover:-translate-y-0.5"
          >
            <PlusCircle size={16} />
            Nová analýza
          </Link>
        </div>
      </div>

      {/* Search bar – same pattern as Contacts filter panel */}
      {analyses.length > 0 && (
        <div className="bg-white p-2 rounded-[var(--wp-radius-sm)] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <div className="relative flex-1 md:w-72 min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Hledat podle klienta…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-[var(--wp-radius-sm)] text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
            </div>
          </div>
        </div>
      )}

      {/* Primary CTA when empty */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Link
          href="/portal/analyses/financial"
          className="inline-flex items-center gap-4 min-h-[44px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 hover:border-indigo-300 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-indigo-700" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-slate-800 block">Finanční analýza</span>
            <span className="text-slate-500 text-sm">7krokový wizard: cashflow, bilance, cíle, strategie, report.</span>
          </div>
        </Link>
      </div>

      {/* List of saved analyses */}
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-3">Uložené analýzy</h2>
        {filteredList.length === 0 ? (
          <div className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-500 text-sm">
              {analyses.length === 0
                ? "Zatím nemáte žádné uložené analýzy. Vytvořte novou nebo otevřete analýzu z profilu klienta."
                : "Žádná analýza neodpovídá hledanému výrazu."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredList.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/portal/analyses/financial?id=${encodeURIComponent(a.id)}`}
                  className="flex items-center gap-4 min-h-[44px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 hover:border-indigo-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-800 block truncate">{a.clientName || "Bez názvu"}</span>
                    <span className="text-slate-500 text-sm">
                      Upraveno {formatUpdated(a.updatedAt)} · {a.status === "draft" ? "Koncept" : a.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
