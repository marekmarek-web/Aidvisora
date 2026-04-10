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
      <h2 className="text-lg font-bold text-[color:var(--wp-text)] mb-1">Tabulka členů</h2>
      <p className="mb-3 text-xs text-[color:var(--wp-text-secondary)] sm:text-sm">
        Metriky a kariérní štítky — otevřete řádek pro detail, 1:1 agendu a coaching.
      </p>
      <div className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--wp-surface-card-border)]">
            <thead>
              <tr className="bg-[color:var(--wp-surface-muted)]/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">Člen</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">
                  <span className="block">Jednotky</span>
                  <span className="block text-[10px] font-normal normal-case text-[color:var(--wp-text-tertiary)] leading-tight">
                    {TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE}
                  </span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">Produkce</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">Schůzky</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">Konverze</th>
                {scope === "full" && (
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">Nadřízený</th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">Aktivita</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">Stav</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--wp-surface-card-border)]">
              {visibleMembers.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-[color:var(--wp-text-secondary)]">
                    {membersInScopeCount === 0 ? (
                      <>V tomto rozsahu zatím nejsou žádní členové — zkuste jiný rozsah v hlavičce nebo doplnění hierarchie.</>
                    ) : (
                      <>
                        Žádný člen neodpovídá filtru nebo vyhledávání. Upravte segment, výkonové řazení nebo hledaný text — výběr v bočním panelu zůstane, pokud je člen stále v rozsahu.
                      </>
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
                        "cursor-pointer hover:bg-[color:var(--wp-surface-muted)]/50",
                        selectedUserId === m.userId && "bg-violet-50/80 ring-1 ring-inset ring-violet-200/70"
                      )}
                      onClick={() => selectMember(m.userId)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[color:var(--wp-text)]">{displayName(m)}</span>
                        <p className="text-xs text-[color:var(--wp-text-secondary)]">
                          {m.roleName}
                          {m.email ? ` · ${m.email}` : ""}
                        </p>
                        {ce?.summaryLine ? <p className="text-[11px] text-[color:var(--wp-text-tertiary)] mt-0.5">{ce.summaryLine}</p> : null}
                        {ce ? (
                          <div className="mt-1 space-y-0.5 max-w-[16rem]">
                            <p className="text-[10px] font-medium text-violet-900/85">{ce.managerProgressLabel}</p>
                            <div className="flex flex-wrap gap-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${overviewCareerProgressBadgeClass(ce.progressEvaluation)}`}
                                title="Technický stav evaluace (orientační)"
                              >
                                {careerProgressShortLabel(ce.progressEvaluation)}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${overviewCareerCompletenessBadgeClass(ce.evaluationCompleteness)}`}
                                title="Úplnost automatické části evaluace"
                              >
                                {careerCompletenessShortLabel(ce.evaluationCompleteness)}
                              </span>
                            </div>
                            <p className="text-[10px] leading-snug text-[color:var(--wp-text-secondary)]">{ce.hintShort}</p>
                            {ce.nextCareerPositionLabel ? (
                              <p className="text-[10px] text-[color:var(--wp-text-tertiary)]">Další krok: {ce.nextCareerPositionLabel}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--wp-text-secondary)]">{met?.unitsThisPeriod ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--wp-text-secondary)]">
                        {met ? formatTeamOverviewProduction(met.productionThisPeriod) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--wp-text-secondary)]">{met?.meetingsThisPeriod ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--wp-text-secondary)]">
                        {met ? `${Math.round(met.conversionRate * 100)}%` : "—"}
                      </td>
                      {scope === "full" && (
                        <td className="px-4 py-3 text-right text-sm text-[color:var(--wp-text-secondary)]">{m.managerName ?? "—"}</td>
                      )}
                      <td className="px-4 py-3 text-right text-sm text-[color:var(--wp-text-secondary)]">{met?.activityCount ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {met && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              met.riskLevel === "critical"
                                ? "bg-rose-100 text-rose-700"
                                : met.riskLevel === "warning"
                                  ? "bg-amber-100 text-amber-700"
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
                      <td>
                        <Link
                          href={memberDetailHref(m.userId)}
                          className="inline-flex p-2 text-[color:var(--wp-text-tertiary)] hover:text-indigo-600"
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
                    "relative block p-4 hover:bg-[color:var(--wp-surface-muted)]/50 active:bg-[color:var(--wp-surface-muted)] cursor-pointer",
                    selectedUserId === m.userId && "bg-violet-50/80"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-[color:var(--wp-text)]">{displayName(m)}</p>
                      <p className="text-xs text-[color:var(--wp-text-secondary)]">
                        {m.roleName}
                        {m.email ? ` · ${m.email}` : ""}
                      </p>
                      {ce?.summaryLine ? <p className="text-[11px] text-[color:var(--wp-text-tertiary)] mt-0.5">{ce.summaryLine}</p> : null}
                      {ce ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-[10px] font-medium text-violet-900/85">{ce.managerProgressLabel}</p>
                          <div className="flex flex-wrap gap-1">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${overviewCareerProgressBadgeClass(ce.progressEvaluation)}`}>
                              {careerProgressShortLabel(ce.progressEvaluation)}
                            </span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${overviewCareerCompletenessBadgeClass(ce.evaluationCompleteness)}`}>
                              {careerCompletenessShortLabel(ce.evaluationCompleteness)}
                            </span>
                          </div>
                          <p className="text-[10px] text-[color:var(--wp-text-secondary)]">{ce.hintShort}</p>
                          {ce.nextCareerPositionLabel ? (
                            <p className="text-[10px] text-[color:var(--wp-text-tertiary)]">Další krok: {ce.nextCareerPositionLabel}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        met?.riskLevel === "critical"
                          ? "bg-rose-100 text-rose-700"
                          : met?.riskLevel === "warning"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]"
                      }`}
                    >
                      {met?.riskLevel === "critical"
                        ? "Vyžaduje podporu"
                        : met?.riskLevel === "warning"
                          ? "Potřebuje pozornost"
                          : "Stabilní"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-[color:var(--wp-text-secondary)]">
                    <span>Jednotky: {met?.unitsThisPeriod ?? "—"}</span>
                    <span>Produkce: {met ? formatTeamOverviewProduction(met.productionThisPeriod) : "—"}</span>
                    <span>Schůzky: {met?.meetingsThisPeriod ?? "—"}</span>
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--wp-text-secondary)]">
                    Konverze: {met ? `${Math.round(met.conversionRate * 100)} %` : "—"}
                    {m.managerName ? ` · Nadřízený: ${m.managerName}` : ""}
                  </div>
                  <Link
                    href={memberDetailHref(m.userId)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[color:var(--wp-text-tertiary)] hover:text-indigo-600"
                    aria-label="Plný detail"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
