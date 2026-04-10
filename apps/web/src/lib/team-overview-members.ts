/**
 * Řazení a filtrování členů na Team Overview (proxy logika — názvy funkcí to přiznávají).
 */

import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";
import { memberMatchesPeopleSegment, type PeopleSegmentFilter } from "@/lib/team-overview-page-model";

export type PerformanceSort = "all" | "top" | "bottom";

/** Seřadí členy podle výkonu nebo jména. */
export function sortTeamMembersForOverview(
  members: TeamMemberInfo[],
  metricsByUser: Map<string, TeamMemberMetrics>,
  performanceFilter: PerformanceSort
): TeamMemberInfo[] {
  const sorted = [...members];
  sorted.sort((a, b) => {
    const ma = metricsByUser.get(a.userId);
    const mb = metricsByUser.get(b.userId);
    const byPerf = (mb?.productionThisPeriod ?? 0) - (ma?.productionThisPeriod ?? 0);
    if (performanceFilter === "top") return byPerf;
    if (performanceFilter === "bottom") return -byPerf;
    return (a.displayName || "").localeCompare(b.displayName || "", "cs-CZ");
  });
  return sorted;
}

export type VisibleMembersInput = {
  sortedMembers: TeamMemberInfo[];
  metricsByUser: Map<string, TeamMemberMetrics>;
  newcomerSet: Set<string>;
  attentionUserIds: Set<string>;
  peopleSegment: PeopleSegmentFilter;
  peopleQueryTrimmed: string;
};

/**
 * Filtrovaný seznam pro tabulku (segment + vyhledávání).
 * „Stabilní“ segment je proxy: viz `memberMatchesPeopleSegment` v page-model.
 */
export function getVisibleTeamMembers(input: VisibleMembersInput): TeamMemberInfo[] {
  const q = input.peopleQueryTrimmed.toLowerCase();
  return input.sortedMembers.filter((m) => {
    const mm = input.metricsByUser.get(m.userId);
    if (!mm) return true;
    if (
      !memberMatchesPeopleSegment(m, input.peopleSegment, {
        metricsByUser: input.metricsByUser,
        newcomerSet: input.newcomerSet,
        attentionUserIds: input.attentionUserIds,
      })
    ) {
      return false;
    }
    if (q) {
      const name = (m.displayName || "").toLowerCase();
      const email = (m.email || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });
}

/** Je vybraný člen stále v aktuálním scope (seznam members ze serveru)? */
export function isSelectedMemberInScope(selectedUserId: string | null, members: TeamMemberInfo[]): boolean {
  if (!selectedUserId) return false;
  return members.some((m) => m.userId === selectedUserId);
}

/** Je vybraný člen v aktuálně vyfiltrovaném seznamu? (jinak jen info do panelu, ne mazat výběr.) */
export function isSelectedInFilteredList(selectedUserId: string | null, visibleMembers: TeamMemberInfo[]): boolean {
  if (!selectedUserId) return false;
  return visibleMembers.some((m) => m.userId === selectedUserId);
}
