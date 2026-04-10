import { describe, it, expect } from "vitest";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";
import {
  sortTeamMembersForOverview,
  getVisibleTeamMembers,
  isSelectedMemberInScope,
  isSelectedInFilteredList,
} from "@/lib/team-overview-members";

function member(id: string, name: string, role = "Advisor"): TeamMemberInfo {
  return {
    userId: id,
    displayName: name,
    email: `${id}@test.dev`,
    roleName: role,
    managerName: null,
  };
}

function metric(userId: string, production: number): TeamMemberMetrics {
  return {
    userId,
    productionThisPeriod: production,
    unitsThisPeriod: 0,
    meetingsThisPeriod: 0,
    conversionRate: 0,
    activityCount: 0,
    daysWithoutActivity: 0,
    directReportsCount: 0,
    riskLevel: "ok",
    careerEvaluation: {
      careerProgramId: "not_set",
      careerTrackId: "not_set",
      careerPositionLabel: null,
      progressEvaluation: "on_track",
      evaluationCompleteness: "full",
      managerProgressLabel: "",
      summaryLine: null,
      hintShort: "",
      nextCareerPositionLabel: null,
    },
  };
}

describe("sortTeamMembersForOverview", () => {
  it("sorts by name when performance filter is all", () => {
    const members = [member("b", "Beta"), member("a", "Alpha")];
    const byUser = new Map<string, TeamMemberMetrics>([
      ["a", metric("a", 100)],
      ["b", metric("b", 200)],
    ]);
    const sorted = sortTeamMembersForOverview(members, byUser, "all");
    expect(sorted.map((m) => m.userId)).toEqual(["a", "b"]);
  });

  it("orders by production for top", () => {
    const members = [member("low", "L"), member("high", "H")];
    const byUser = new Map<string, TeamMemberMetrics>([
      ["low", metric("low", 10)],
      ["high", metric("high", 99)],
    ]);
    const sorted = sortTeamMembersForOverview(members, byUser, "top");
    expect(sorted[0].userId).toBe("high");
  });
});

describe("getVisibleTeamMembers", () => {
  it("filters by search on name", () => {
    const sorted = [member("1", "Jan Novák"), member("2", "Eva")];
    const byUser = new Map(sorted.map((m) => [m.userId, metric(m.userId, 1)]));
    const out = getVisibleTeamMembers({
      sortedMembers: sorted,
      metricsByUser: byUser,
      newcomerSet: new Set(),
      attentionUserIds: new Set(),
      peopleSegment: "all",
      peopleQueryTrimmed: "jan",
    });
    expect(out).toHaveLength(1);
    expect(out[0].userId).toBe("1");
  });
});

describe("selected member helpers", () => {
  it("isSelectedMemberInScope", () => {
    expect(isSelectedMemberInScope("a", [member("a", "A")])).toBe(true);
    expect(isSelectedMemberInScope("x", [member("a", "A")])).toBe(false);
    expect(isSelectedMemberInScope(null, [])).toBe(false);
  });

  it("isSelectedInFilteredList", () => {
    const vis = [member("a", "A")];
    expect(isSelectedInFilteredList("a", vis)).toBe(true);
    expect(isSelectedInFilteredList("b", vis)).toBe(false);
  });
});
