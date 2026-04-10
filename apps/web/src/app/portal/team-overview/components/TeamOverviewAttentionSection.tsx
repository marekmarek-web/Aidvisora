"use client";

import { AlertTriangle, CheckCircle2, HeartHandshake } from "lucide-react";
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
}: {
  scope: TeamOverviewScope;
  members: TeamMemberInfo[];
  displayName: (m: TeamMemberInfo) => string;
  topAttentionAlerts: TeamAlert[];
  pageModel: TeamOverviewPageModel;
  selectMember: (userId: string) => void;
  canCreateTeamCalendar: boolean;
}) {
  if (scope === "me") {
    return (
      <section
        className="mb-8 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-5 shadow-sm"
        aria-labelledby="self-priority-heading"
      >
        <h2 id="self-priority-heading" className="text-lg font-bold text-[color:var(--wp-text)]">
          Váš kontext
        </h2>
        <p className="mt-2 text-sm text-[color:var(--wp-text-secondary)]">
          V režimu „Já“ jsou priorita a coaching u jednotlivých členů v detailu osoby. Níže najdete kariérní přehled, metriky a trendy.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8" aria-labelledby="team-priority-heading">
      <div className="mb-4">
        <h2 id="team-priority-heading" className="text-lg font-bold text-[color:var(--wp-text)] sm:text-xl">
          Kdo vyžaduje pozornost · doporučené navázání
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-[color:var(--wp-text-secondary)] sm:text-sm">
          Signály z CRM a doporučení z kariérní vrstvy — orientační návrh dalšího kroku, ne hodnocení lidí.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 shadow-sm sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--wp-text)]">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            Signály (CRM a kariéra)
          </h3>
          {topAttentionAlerts.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center rounded-xl border border-emerald-200/60 bg-emerald-50/35 px-4 py-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="font-semibold text-emerald-900">V mezích</p>
                  <p className="mt-1 text-sm leading-relaxed text-emerald-900/85">
                    Žádné naléhavé signály pro tento rozsah. Udržujte klidný rytmus kontaktu — sekce níže ukáže růst, adaptaci a naplánované termíny.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {topAttentionAlerts.map((a, i) => {
                const alertMember = members.find((m) => m.userId === a.memberId);
                const name = alertMember ? displayName(alertMember) : "Člen týmu";
                const tone = a.severity === "critical" ? ("Vyžaduje podporu" as const) : ("Potřebuje pozornost" as const);
                return (
                  <li key={`${a.memberId}-${i}`}>
                    <button
                      type="button"
                      onClick={() => selectMember(a.memberId)}
                      className="block w-full text-left rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/35 px-3 py-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-tertiary)]">{tone}</span>
                      <p className="mt-0.5 text-sm font-medium text-[color:var(--wp-text)]">{name}</p>
                      <p className="line-clamp-2 text-xs text-[color:var(--wp-text-secondary)]">{a.title}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex flex-col rounded-2xl border border-violet-200/60 bg-gradient-to-b from-violet-50/40 to-[color:var(--wp-surface-card)] p-4 shadow-sm sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--wp-text)]">
            <HeartHandshake className="h-4 w-4 shrink-0 text-violet-600" />
            Doporučené navázání (kariéra &amp; coaching)
          </h3>
          {pageModel.coachingAttention.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center rounded-xl border border-slate-200/80 bg-[color:var(--wp-surface-card)]/80 px-4 py-5">
              <p className="font-semibold text-[color:var(--wp-text)]">Žádný výrazný návrh navíc</p>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--wp-text-secondary)]">
                Podle kariérní vrstvy a adaptace zatím nikdo nevyčnívá v prioritním seznamu — pokračujte v pravidelných 1:1 a sledujte blok „Kariérní přehled“ níže.
              </p>
            </div>
          ) : (
            <>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {pageModel.coachingAttention.map((c) => {
                  const mem = members.find((m) => m.userId === c.userId);
                  const name = mem ? displayName(mem) : c.displayName || c.email || "Člen týmu";
                  return (
                    <li key={c.userId}>
                      <button
                        type="button"
                        onClick={() => selectMember(c.userId)}
                        className="block w-full text-left rounded-xl border border-violet-200/50 bg-violet-50/50 px-3 py-2.5 transition hover:bg-violet-50/90"
                      >
                        <p className="text-sm font-medium text-[color:var(--wp-text)]">{name}</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--wp-text-secondary)]">{c.reasonCs}</p>
                        <p className="mt-1 text-[11px] font-semibold text-violet-900">{c.recommendedActionLabelCs}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {canCreateTeamCalendar ? (
                <a href="#team-calendar-actions" className="mt-3 inline-flex text-xs font-medium text-indigo-600 hover:underline">
                  Naplánovat týmovou schůzku nebo úkol — akce v záhlaví
                </a>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
