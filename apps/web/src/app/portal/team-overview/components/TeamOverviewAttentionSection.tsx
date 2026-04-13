"use client";

import { AlertTriangle, CheckCircle2, HeartHandshake, ChevronRight } from "lucide-react";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { TeamAlert } from "@/lib/team-overview-alerts";
import type { TeamOverviewPageModel } from "@/lib/team-overview-page-model";
import type { TeamOverviewScope } from "@/lib/team-hierarchy-types";

export function TeamOverviewAttentionSection({
  scope,
  members,
  displayName,
  topAttentionAlerts,
  pageModel,
  selectMember,
  canCreateTeamCalendar,
  /** Úzký sloupec first foldu — méně spodní mezery a méně dekorativního zvýraznění vedlejšího panelu. */
  variant = "default",
}: {
  scope: TeamOverviewScope;
  members: TeamMemberInfo[];
  displayName: (m: TeamMemberInfo) => string;
  topAttentionAlerts: TeamAlert[];
  pageModel: TeamOverviewPageModel;
  selectMember: (userId: string) => void;
  canCreateTeamCalendar: boolean;
  variant?: "default" | "firstFold";
}) {
  if (scope === "me") {
    return (
      <section
        className="mb-8 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm"
        aria-labelledby="self-priority-heading"
      >
        <h2 id="self-priority-heading" className="text-base font-bold text-[color:var(--wp-text)]">
          Váš kontext
        </h2>
        <p className="mt-1.5 text-sm text-[color:var(--wp-text-secondary)] max-w-xl">
          V osobním rozsahu jsou priorita a coaching u jednotlivých členů v detailu osoby. Níže najdete kariérní přehled, metriky a naplánované termíny.
        </p>
      </section>
    );
  }

  const hasCritical = topAttentionAlerts.some((a) => a.severity === "critical");
  const isFirstFold = variant === "firstFold";

  return (
    <section className={isFirstFold ? "mb-0" : "mb-8"} aria-labelledby="team-priority-heading">
      <div className={`flex items-end justify-between gap-3 ${isFirstFold ? "mb-4" : "mb-4"}`}>
        <div>
          <h2 id="team-priority-heading" className="text-xl font-black tracking-tight text-[color:var(--wp-text)]">
            Kdo potřebuje pozornost
          </h2>
          <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">Signály z CRM a kariéry.</p>
        </div>
        {hasCritical && (
          <span className="shrink-0 inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
            Vyžaduje podporu
          </span>
        )}
      </div>

      <div className={`grid gap-4 ${isFirstFold ? "lg:grid-cols-1 xl:grid-cols-2" : "lg:grid-cols-2"}`}>
        {/* Signály */}
        <div className="flex flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/60 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <h3 className="text-sm font-bold text-[color:var(--wp-text)]">Signály</h3>
            {topAttentionAlerts.length > 0 && (
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-amber-700">
                {topAttentionAlerts.length}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col p-3">
            {topAttentionAlerts.length === 0 ? (
              <div className="flex flex-1 items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/40 px-4 py-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="font-semibold text-emerald-900 text-sm">Stabilní</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-800/80">
                    Žádné naléhavé signály v tomto rozsahu. Udržujte klidný rytmus kontaktu.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                {topAttentionAlerts.map((a, i) => {
                  const alertMember = members.find((m) => m.userId === a.memberId);
                  const name = alertMember ? displayName(alertMember) : "Člen týmu";
                  const isCritical = a.severity === "critical";
                  return (
                    <li key={`${a.memberId}-${i}`}>
                      <button
                        type="button"
                        onClick={() => selectMember(a.memberId)}
                      className="group block w-full rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-left transition hover:border-amber-200 hover:bg-amber-50/30"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] ${
                              isCritical
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isCritical ? "Vyžaduje podporu" : "Potřebuje pozornost"}
                          </span>
                          <ChevronRight className="ml-auto h-3.5 w-3.5 text-[color:var(--wp-text-tertiary)] opacity-0 transition group-hover:opacity-100" aria-hidden />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--wp-text)]">{name}</p>
                        <p className="line-clamp-1 text-xs text-[color:var(--wp-text-secondary)]">{a.title}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Doporučené navázání */}
        <div className="flex flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div
            className={
              isFirstFold
                ? "flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/60 px-4 py-3"
                : "flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/60 px-4 py-3"
            }
          >
            <HeartHandshake className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
            <h3 className="text-sm font-bold text-[color:var(--wp-text)]">Doporučené navázání</h3>
            {pageModel.coachingAttention.length > 0 && (
              <span className="ml-auto text-[11px] font-semibold tabular-nums text-violet-700">
                {pageModel.coachingAttention.length}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col p-3">
            {pageModel.coachingAttention.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center rounded-xl border border-slate-200/70 bg-[color:var(--wp-surface-card)]/80 px-4 py-4">
                <p className="font-semibold text-sm text-[color:var(--wp-text)]">Vyrovnaný přehled</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--wp-text-secondary)]">
                  Z kariérního pohledu nikdo nevyčnívá. Pokračujte v pravidelných 1:1.
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                  {pageModel.coachingAttention.map((c) => {
                    const mem = members.find((m) => m.userId === c.userId);
                    const name = mem ? displayName(mem) : c.displayName || c.email || "Člen týmu";
                    return (
                      <li key={c.userId}>
                        <button
                          type="button"
                          onClick={() => selectMember(c.userId)}
                        className="group block w-full rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-left transition hover:border-violet-200 hover:bg-violet-50/60"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--wp-text)]">{name}</p>
                            <ChevronRight className="ml-auto h-3.5 w-3.5 text-violet-400 opacity-0 transition group-hover:opacity-100" aria-hidden />
                          </div>
                          <p className="mt-0.5 text-xs text-[color:var(--wp-text-secondary)] line-clamp-1">{c.reasonCs}</p>
                          <p className="mt-1 text-[11px] font-bold text-violet-800">{c.recommendedActionLabelCs}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {canCreateTeamCalendar ? (
                  <a
                    href="#team-calendar-actions"
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Naplánovat schůzku nebo úkol
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
