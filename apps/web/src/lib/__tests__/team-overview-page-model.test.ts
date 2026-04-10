import { describe, it, expect } from "vitest";
import { buildTeamOverviewPageModel } from "@/lib/team-overview-page-model";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";
import type { TeamMemberInfo } from "@/app/actions/team-overview";

function minimalMember(id: string): TeamMemberInfo {
  return {
    userId: id,
    displayName: id,
    email: null,
    roleName: "Advisor",
    managerName: null,
  };
}

function metricWithProgram(userId: string, program: "beplan" | "premium_brokers" | "not_set", units: number): TeamMemberMetrics {
  const base: TeamMemberMetrics = {
    userId,
    productionThisPeriod: 0,
    unitsThisPeriod: units,
    meetingsThisPeriod: 0,
    conversionRate: 0,
    activityCount: 0,
    daysWithoutActivity: 0,
    directReportsCount: 0,
    riskLevel: "ok",
    careerEvaluation: {
      careerProgramId: program,
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
  return base;
}

describe("buildTeamOverviewPageModel poolSplit", () => {
  it("aggregates units per pool from metrics", () => {
    const members = [minimalMember("a"), minimalMember("b")];
    const metrics = [metricWithProgram("a", "beplan", 3), metricWithProgram("b", "premium_brokers", 5)];
    const model = buildTeamOverviewPageModel({
      scope: "full",
      kpis: null,
      members,
      metrics,
      newcomers: [],
      alerts: [],
      rhythmCalendar: null,
    });
    expect(model.poolSplit.units.beplan).toBe(3);
    expect(model.poolSplit.units.premium_brokers).toBe(5);
    expect(model.poolSplit.counts.beplan).toBe(1);
    expect(model.poolSplit.counts.premium_brokers).toBe(1);
  });
});
