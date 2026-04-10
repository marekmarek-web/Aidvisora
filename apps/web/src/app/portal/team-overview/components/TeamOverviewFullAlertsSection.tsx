"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { TeamAlert } from "@/lib/team-overview-alerts";

export function TeamOverviewFullAlertsSection({
  alerts,
  selectMember,
  memberDetailHref,
}: {
  alerts: TeamAlert[];
  selectMember: (userId: string) => void;
  memberDetailHref: (userId: string) => string;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-[color:var(--wp-text)] mb-1">Kompletní výpis signálů</h2>
      <p className="mb-3 text-xs text-[color:var(--wp-text-secondary)]">
        CRM i kariérní upozornění — totéž, co v přehledu nahoře; zde celý seznam pro kontrolu nebo tisk.
      </p>
      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/30 px-5 py-6 text-center">
          <p className="font-medium text-emerald-900">Žádné další signály</p>
          <p className="mt-1 text-sm text-emerald-900/85">
            V tomto období a rozsahu je výpis prázdný — žádné sledované signály z CRM ani kariéry.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 shadow-sm hover:border-amber-200 hover:bg-amber-50/50 transition">
                <button
                  type="button"
                  onClick={() => selectMember(a.memberId)}
                  className="flex flex-1 flex-wrap items-center gap-2 text-left min-w-0"
                >
                  <span className={`rounded-full p-1 shrink-0 ${a.severity === "critical" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <span className="font-medium text-[color:var(--wp-text)]">{a.title}</span>
                  <span className="text-[color:var(--wp-text-secondary)] text-sm">{a.description}</span>
                  <ChevronRight className="w-4 h-4 text-[color:var(--wp-text-tertiary)] ml-auto shrink-0" />
                </button>
                <Link
                  href={memberDetailHref(a.memberId)}
                  className="text-xs font-medium text-indigo-600 hover:underline shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  Plný detail
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
