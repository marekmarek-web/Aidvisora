import { describe, it, expect } from "vitest";
import {
  countBranchSize,
  completenessToPercent,
  classifyStructureRole,
} from "@/lib/team-overview-structure-classification";
import type { TeamTreeNode } from "@/lib/team-hierarchy-types";

function node(
  id: string,
  children: TeamTreeNode[] = [],
  overrides: Partial<TeamTreeNode> = {}
): TeamTreeNode {
  return {
    userId: id,
    parentId: null,
    roleName: "Advisor",
    joinedAt: new Date(),
    displayName: id,
    email: null,
    careerProgram: null,
    careerTrack: null,
    careerPositionCode: null,
    depth: 0,
    children,
    ...overrides,
  };
}

describe("countBranchSize", () => {
  it("counts root with no children as 1", () => {
    expect(countBranchSize(node("a"))).toBe(1);
  });

  it("counts nested tree", () => {
    const tree = node("root", [node("c1", [node("c11")]), node("c2")]);
    expect(countBranchSize(tree)).toBe(4);
  });
});

describe("completenessToPercent", () => {
  it("maps completeness levels", () => {
    expect(completenessToPercent("full")).toBe(100);
    expect(completenessToPercent("partial")).toBe(70);
  });
});

describe("classifyStructureRole", () => {
  it("marks newcomers", () => {
    expect(classifyStructureRole({ isNewcomer: true, directReportsCount: 0, roleName: "Advisor", progressEvaluation: "on_track", productionThisPeriod: 0, approximateProductionTarget: null }).kind).toBe("rookie");
  });
});
