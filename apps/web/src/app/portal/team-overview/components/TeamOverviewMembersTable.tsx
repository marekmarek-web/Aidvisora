"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";
import type { TeamOverviewScope } from "@/lib/team-hierarchy-types";
import { careerCompletenessShortLabel, careerProgressShortLabel } from "@/lib/career/career-ui-labels";
import { formatTeamOverviewProduction, TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE } from "@/lib/team-overview-format";
import { overviewCareerCompletenessBadgeClass, overviewCareerProgressBadgeClass } from "@/lib/team-overview-career-badges";

export function TeamOverviewMembersTable({
  scope,
  visibleMembers,
  membersInScopeCount,
  metricsByUser,
  selectedUserId,
  selectMember,
  memberDetailHref,
  displayName,
}: {
  scope: TeamOverviewScope;
  visibleMembers: TeamMemberInfo[];
  membersInScopeCount: number;
  metricsByUser: Map<string, TeamMemberMetrics>;
  selectedUserId: string | null;
  selectMember: (userId: string) => void;
  memberDetailHref: (userId: string) => string;
  displayName: (m: TeamMemberInfo) => string;
}) {
  const colSpan = scope === "full" ? 9 : 8;

  return (
    <section id="clenove">
      <div className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--wp-surface-card-border)]">
            <thead>
              <tr className="bg-[color:var(--wp-surface-muted)]/60">
                <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                  Člen
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                  <span className="block">Jedn.</span>
                  <span className="block text-[9px] font-normal normal-case text-[color:var(--wp-text-tertiary)]/70 leading-tight">
                    {TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE}
                  </span>
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Produkce</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Schůzky</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Konverze</th>
                {scope === "full" && (
                  <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Nadřízený</th>
                )}
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Aktivita</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Stav</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wp-surface-card-border)]">
              {visibleMembers.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-[color:var(--wp-text-secondary)]">
                    {membersInScopeCount === 0 ? (
                      <>V tomto rozsahu zatím nejsou žádní členové — zkuste jiný rozsah nebo doplnění hierarchie.</>
                    ) : (
                      <>Žádný člen neodpovídá filtru — upravte segment nebo vyhledávání.</>
                    )}
                  </td>
                </tr>
              ) : (
                visibleMembers.map((m) => {
                  const met = metricsByUser.get(m.userId);
                  const ce = met?.careerEvaluation;
                  return (
                    <tr
                      key={m.userId}
                      className={clsx(
                        "cursor-pointer transition hover:bg-[color:var(--wp-surface-muted)]/40",
                        selectedUserId === m.userId && "bg-violet-50/70 ring-1 ring-inset ring-violet-200/60"
                      )}
                      onClick={() => selectMember(m.userId)}
                    >
                      <td className="px-4 py-2.5 min-w-[180px]">
                        <span className="font-semibold text-sm text-[color:var(--wp-text)]">{displayName(m)}</span>
                        <p className="text-[11px] text-[color:var(--wp-text-tertiary)]">
                          {m.roleName}
                          {m.careerProgram ? ` · ${m.careerProgram}` : ""}
                        </p>
                        {ce ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span
                              className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${overviewCareerProgressBadgeClass(ce.progressEvaluation)}`}
                            >
                              {careerProgressShortLabel(ce.progressEvaluation)}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${overviewCareerCompletenessBadgeClass(ce.evaluationCompleteness)}`}
                            >
                              {careerCompletenessShortLabel(ce.evaluationCompleteness)}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[color:var(--wp-text-secondary)]">{met?.unitsThisPeriod ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[color:var(--wp-text-secondary)]">
                        {met ? formatTeamOverviewProduction(met.productionThisPeriod) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[color:var(--wp-text-secondary)]">{met?.meetingsThisPeriod ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[color:var(--wp-text-secondary)]">
                        {met ? `${Math.round(met.conversionRate * 100)} %` : "—"}
                      </td>
                      {scope === "full" && (
                        <td className="px-4 py-2.5 text-right text-xs text-[color:var(--wp-text-secondary)]">{m.managerName ?? "—"}</td>
                      )}
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[color:var(--wp-text-secondary)]">{met?.activityCount ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {met && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              met.riskLevel === "critical"
                                ? "bg-rose-100 text-rose-800"
                                : met.riskLevel === "warning"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]"
                            }`}
                          >
                            {met.riskLevel === "critical"
                              ? "Vyžaduje podporu"
                              : met.riskLevel === "warning"
                                ? "Potřebuje pozornost"
                                : "Stabilní"}
                          </span>
                        )}
                      </td>
                      <td className="pr-2">
                        <Link
                          href={memberDetailHref(m.userId)}
                          className="inline-flex p-1.5 text-[color:var(--wp-text-tertiary)] hover:text-indigo-600"
                          aria-label="Detail"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-[color:var(--wp-surface-card-border)]">
          {visibleMembers.length === 0 ? (
            <div className="p-6 text-center text-sm text-[color:var(--wp-text-secondary)]">
              {membersInScopeCount === 0 ? (
                <>V tomto rozsahu zatím nejsou žádní členové.</>
              ) : (
                <>Žádný člen neodpovídá filtru — upravte segment nebo vyhledávání.</>
              )}
            </div>
          ) : (
            visibleMembers.map((m) => {
              const met = metricsByUser.get(m.userId);
              const ce = met?.careerEvaluation;
              return (
                <div
                  key={m.userId}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectMember(m.userId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectMember(m.userId);
                    }
                  }}
                  className={clsx(
                    "relative block p-3.5 hover:bg-[color:var(--wp-surface-muted)]/40 active:bg-[color:var(--wp-surface-muted)] cursor-pointer",
                    selectedUserId === m.userId && "bg-violet-50/70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[color:var(--wp-text)]">{displayName(m)}</p>
                      <p className="text-[11px] text-[color:var(--wp-text-tertiary)]">
                        {m.roleName}{m.careerProgram ? ` · ${m.careerProgram}` : ""}
                      </p>
                      {ce ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${overviewCareerProgressBadgeClass(ce.progressEvaluation)}`}>
                            {careerProgressShortLabel(ce.progressEvaluation)}
                          </span>
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${overviewCareerCompletenessBadgeClass(ce.evaluationCompleteness)}`}>
                            {careerCompletenessShortLabel(ce.evaluationCompleteness)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          met?.riskLevel === "critical"
                            ? "bg-rose-100 text-rose-800"
                            : met?.riskLevel === "warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]"
                        }`}
                      >
                        {met?.riskLevel === "critical"
                          ? "Vyžaduje podporu"
                          : met?.riskLevel === "warning"
                            ? "Potřebuje pozornost"
                            : met
                              ? "Stabilní"
                              : "—"}
                      </span>
                      <Link
                        href={memberDetailHref(m.userId)}
                        className="p-1 text-[color:var(--wp-text-tertiary)] hover:text-indigo-600"
                        aria-label="Plný detail"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-[color:var(--wp-text-secondary)] tabular-nums">
                    <span>Jedn. {met?.unitsThisPeriod ?? "—"}</span>
                    <span>Prod. {met ? formatTeamOverviewProduction(met.productionThisPeriod) : "—"}</span>
                    <span>Schůzky {met?.meetingsThisPeriod ?? "—"}</span>
                    <span>Konv. {met ? `${Math.round(met.conversionRate * 100)} %` : "—"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
