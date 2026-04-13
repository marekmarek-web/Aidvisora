/**
 * Client-safe helpers: strukturu týmu / větve — čísla záznamů v podstromu, jednoduchá klasifikace role,
 * odhad „readiness“ z completeness a missingRequirements.
 */

import type { ProgressEvaluation, EvaluationCompleteness, MissingRequirement } from "@/lib/career/types";
import type { TeamTreeNode } from "@/lib/team-hierarchy-types";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";

/** Počet členů ve větvi včetně kořene (rekurzivně). */
export function countBranchSize(node: TeamTreeNode): number {
  if (node.children.length === 0) return 1;
  return 1 + node.children.reduce((sum, ch) => sum + countBranchSize(ch), 0);
}

/** Odhad readiness 0–100 z úplnosti evaluace (mock „% hotovo“ / plnění podmínek). */
export function completenessToPercent(completeness: EvaluationCompleteness): number {
  switch (completeness) {
    case "full":
      return 100;
    case "partial":
      return 70;
    case "low_confidence":
      return 45;
    case "manual_required":
      return 30;
    default:
      return 0;
  }
}

/**
 * Readiness jako % splnění požadavků na postup: máme N missing → odhad (1 - missing/totalReq) * 100.
 * totalRequirementsCount je max(pozice.requirements.length, missing.length) pokud total z VM není k dispozici — použijeme missingRequirements.length + proxy.
 */
export function readinessPercentFromRequirements(
  missing: MissingRequirement[],
  totalRequirementsHint?: number | null
): number {
  const missingCount = missing.length;
  if (missingCount === 0) return 100;
  const total = Math.max(totalRequirementsHint ?? 0, missingCount, 1);
  const done = Math.max(0, total - missingCount);
  return Math.round((done / total) * 100);
}

export type StructureRoleKind =
  | "rookie"
  | "engine"
  | "lone_wolf"
  | "weak_middle"
  | "neutral";

export type StructureRoleClassification = {
  kind: StructureRoleKind;
  /** Krátký popisek pro UI (česky). */
  labelCs: string;
};

/**
 * Heuristická klasifikace pro „motor / samostatník / slabý střed“ — orientační, ne smluvní pravda.
 */
export function classifyStructureRole(input: {
  isNewcomer: boolean;
  directReportsCount: number;
  roleName: string;
  progressEvaluation: ProgressEvaluation;
  productionThisPeriod: number;
  /** Aproximace cíle — např. podíl týmového cíle na člověka (Kč). */
  approximateProductionTarget: number | null;
}): StructureRoleClassification {
  if (input.isNewcomer) {
    return { kind: "rookie", labelCs: "Nováček v adaptaci" };
  }

  const isManagerish = input.roleName === "Manager" || input.roleName === "Director" || input.roleName === "Admin";
  const hasTeam = input.directReportsCount > 0;
  const target = input.approximateProductionTarget;

  if (hasTeam && target != null && target > 0 && input.productionThisPeriod < target * 0.45) {
    return { kind: "weak_middle", labelCs: "Slabý střed managementu" };
  }

  if (hasTeam && (input.progressEvaluation === "close_to_promotion" || input.progressEvaluation === "promoted_ready")) {
    return { kind: "engine", labelCs: "Motor růstu" };
  }

  if (!hasTeam && (input.roleName === "Advisor" || input.roleName === "Viewer")) {
    return { kind: "lone_wolf", labelCs: "Samostatný výkonář" };
  }

  if (hasTeam && input.productionThisPeriod >= (target ?? 0) * 0.9 && target != null && target > 0) {
    return { kind: "engine", labelCs: "Motor růstu" };
  }

  return { kind: "neutral", labelCs: "Člen týmu" };
}

export type BranchHealthKind = "strong" | "mixed" | "at_risk" | "unknown";

/** Agregace produkce přímých reportů (jednoduchý health hint pro uzel). */
export function deriveBranchHealthLabel(params: {
  nodeProduction: number;
  childrenProductionSum: number;
  riskLevelWorst: "ok" | "warning" | "critical";
}): { kind: BranchHealthKind; labelCs: string } {
  if (params.riskLevelWorst === "critical") {
    return { kind: "at_risk", labelCs: "Vyžaduje zásah" };
  }
  if (params.childrenProductionSum >= params.nodeProduction * 1.1 && params.nodeProduction > 0) {
    return { kind: "strong", labelCs: "Tahoun větve" };
  }
  if (params.childrenProductionSum < params.nodeProduction * 0.4 && params.nodeProduction > 0) {
    return { kind: "mixed", labelCs: "Stagnující větev" };
  }
  return { kind: "unknown", labelCs: "" };
}
