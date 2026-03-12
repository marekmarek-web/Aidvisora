"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlusCircle, BarChart3, FileSpreadsheet } from "lucide-react";
import type { FinancialAnalysisListItem } from "@/app/actions/financial-analyses";
import {
  ListPageShell,
  ListPageHeader,
  ListPageToolbar,
  ListPageSearchInput,
  ListPageEmpty,
  ListPageNoResults,
} from "@/app/components/list-page";

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
    <ListPageShell>
      <ListPageHeader
        title="Finanční analýzy"
        count={filteredList.length}
        totalCount={analyses.length}
        subtitle="Uložené analýzy a nástroje pro doporučení."
        actions={
          <Link
            href="/portal/analyses/financial"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c2e] text-white rounded-[var(--wp-radius-sm)] text-xs font-bold uppercase tracking-wide shadow-md hover:bg-[#2a2d4a] transition-all hover:-translate-y-0.5"
          >
            <PlusCircle size={16} />
            Nová analýza
          </Link>
        }
      />

      {analyses.length === 0 ? (
        <ListPageEmpty
          icon="📊"
          title="Zatím žádné finanční analýzy"
          description="Vytvořte novou analýzu nebo otevřete analýzu z profilu klienta."
          actionLabel="Nová analýza"
          actionHref="/portal/analyses/financial"
        />
      ) : (
        <>
          <ListPageToolbar>
            <ListPageSearchInput
              placeholder="Hledat podle klienta…"
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </ListPageToolbar>

          {filteredList.length === 0 ? (
            <ListPageNoResults onReset={() => setSearchQuery("")} resetLabel="Zrušit vyhledávání" />
          ) : (
            <>
              {/* Rychlá akce – jedna karta */}
              <Link
                href="/portal/analyses/financial"
                className="inline-flex items-center gap-4 min-h-[44px] rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 hover:border-indigo-300 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5 text-indigo-700" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-800 block">Finanční analýza</span>
                  <span className="text-slate-500 text-sm">7krokový wizard: cashflow, bilance, cíle, strategie, report.</span>
                </div>
              </Link>

              <section>
                <h2 className="text-lg font-bold text-slate-800 mb-3">Uložené analýzy</h2>
                <div className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {filteredList.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/portal/analyses/financial?id=${encodeURIComponent(a.id)}`}
                          className="flex items-center gap-4 min-h-[44px] px-4 py-3 hover:bg-slate-50 transition-colors"
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
                </div>
              </section>
            </>
          )}
        </>
      )}
    </ListPageShell>
  );
}
