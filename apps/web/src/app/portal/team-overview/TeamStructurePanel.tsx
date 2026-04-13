"use client";

import Link from "next/link";
import clsx from "clsx";
import { Network, UserCircle, ChevronRight } from "lucide-react";
import type { TeamOverviewScope, TeamTreeNode } from "@/lib/team-hierarchy-types";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";
import { formatTeamOverviewProduction } from "@/lib/team-overview-format";
import {
  classifyStructureRole,
  deriveBranchHealthLabel,
} from "@/lib/team-overview-structure-classification";

function countDescendants(node: TeamTreeNode): number {
  return node.children.reduce((acc, c) => acc + 1 + countDescendants(c), 0);
}

function findNodeInForest(nodes: TeamTreeNode[], userId: string): TeamTreeNode | null {
  for (const n of nodes) {
    if (n.userId === userId) return n;
    const inner = findNodeInForest(n.children, userId);
    if (inner) return inner;
  }
  return null;
}

function TreeBranch({
  nodes,
  currentUserId,
  depth,
  memberDetailQuery,
  selectedUserId,
  onSelectMember,
  metricsByUser,
  newcomerUserIds,
}: {
  nodes: TeamTreeNode[];
  currentUserId: string;
  depth: number;
  memberDetailQuery: string;
  selectedUserId?: string | null;
  onSelectMember?: (userId: string) => void;
  metricsByUser?: Map<string, TeamMemberMetrics>;
  newcomerUserIds?: Set<string>;
}) {
  return (
    <ul className={clsx("space-y-6", depth > 0 && "mt-6 pl-10")}>
      {nodes.map((node) => {
        const below = countDescendants(node);
        const isSelf = node.userId === currentUserId;
        const isSelected = selectedUserId != null && selectedUserId === node.userId;
        const label = node.displayName?.trim() || node.email || "Člen týmu";
        const m = metricsByUser?.get(node.userId);
        const childrenProd = node.children.reduce(
          (s, c) => s + (metricsByUser?.get(c.userId)?.productionThisPeriod ?? 0),
          0
        );
        const isNewcomer = newcomerUserIds?.has(node.userId) ?? false;
        const classification =
          m != null
            ? classifyStructureRole({
                isNewcomer,
                directReportsCount: m.directReportsCount,
                roleName: node.roleName,
                progressEvaluation: m.careerEvaluation.progressEvaluation,
                productionThisPeriod: m.productionThisPeriod,
                approximateProductionTarget:
                  m.targetProgressPercent != null && m.targetProgressPercent > 0
                    ? m.productionThisPeriod / (m.targetProgressPercent / 100)
                    : null,
              })
            : null;
        const health =
          m != null
            ? deriveBranchHealthLabel({
                nodeProduction: m.productionThisPeriod,
                childrenProductionSum: childrenProd,
                riskLevelWorst: m.riskLevel,
              })
            : null;
        return (
          <li key={node.userId}>
            <div className="relative">
              {depth > 0 ? (
                <>
                  <span className="pointer-events-none absolute -left-10 top-6 h-px w-10 bg-slate-300" />
                  <span className="pointer-events-none absolute -left-10 -top-6 h-12 w-px bg-slate-300" />
                </>
              ) : null}
              <div
                className={clsx(
                  "group flex flex-wrap items-center gap-x-2 gap-y-2 rounded-[24px] border px-5 py-5 text-sm transition",
                  depth === 0 && "border-slate-800 bg-[#16192b] text-white shadow-xl shadow-slate-900/10",
                  depth > 0 && "bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
                  isSelf && depth > 0 && "border-indigo-200/80 bg-indigo-50/70",
                  isSelected && !isSelf && depth > 0 && "border-violet-200/80 bg-violet-50/80",
                  !isSelf && !isSelected && depth > 0 && "border-slate-200/80 hover:-translate-y-0.5 hover:border-slate-300"
                )}
              >
              {isSelf && (
                <UserCircle className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
              )}
              {onSelectMember ? (
                <button
                  type="button"
                  onClick={() => onSelectMember(node.userId)}
                  className={clsx(
                    "font-semibold text-left text-sm hover:underline",
                    depth === 0
                      ? "text-white"
                      : isSelected
                        ? "text-violet-900"
                        : isSelf
                          ? "text-indigo-900"
                          : "text-[color:var(--wp-text)] hover:text-indigo-600"
                  )}
                >
                  {label}
                </button>
              ) : (
                <Link
                  href={`/portal/team-overview/${node.userId}${memberDetailQuery}`}
                  className="font-semibold text-sm text-[color:var(--wp-text)] hover:text-indigo-600 hover:underline"
                >
                  {label}
                </Link>
              )}
              <span className={clsx("text-[11px]", depth === 0 ? "text-slate-400" : "text-[color:var(--wp-text-tertiary)]")}>{node.roleName}</span>
              {m != null && (
                <span className="text-[10px] text-[color:var(--wp-text-secondary)]">
                  · {formatTeamOverviewProduction(m.productionThisPeriod)}
                </span>
              )}
              {classification && classification.kind !== "neutral" && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {classification.labelCs}
                </span>
              )}
              {health && health.labelCs && (
                <span className="rounded-full border border-amber-200/70 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                  {health.labelCs}
                </span>
              )}
              {below > 0 && (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-[color:var(--wp-text-secondary)]">
                  +{below}
                </span>
              )}
              <Link
                href={`/portal/team-overview/${node.userId}${memberDetailQuery}`}
                className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-[color:var(--wp-text-tertiary)] opacity-0 transition group-hover:opacity-100 hover:text-indigo-600"
                title="Plný detail"
              >
                Detail
              </Link>
              </div>
            </div>
            {node.children.length > 0 && (
              <TreeBranch
                nodes={node.children}
                currentUserId={currentUserId}
                depth={depth + 1}
                memberDetailQuery={memberDetailQuery}
                selectedUserId={selectedUserId}
                onSelectMember={onSelectMember}
                metricsByUser={metricsByUser}
                newcomerUserIds={newcomerUserIds}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function TeamStructurePanel({
  roots,
  currentUserId,
  scope,
  memberDetailQuery = "",
  hierarchyParentLinksConfigured = true,
  selectedUserId = null,
  onSelectMember,
  metricsByUser,
  newcomerUserIds,
}: {
  roots: TeamTreeNode[];
  currentUserId: string;
  scope: TeamOverviewScope;
  memberDetailQuery?: string;
  hierarchyParentLinksConfigured?: boolean;
  selectedUserId?: string | null;
  onSelectMember?: (userId: string) => void;
  metricsByUser?: Map<string, TeamMemberMetrics>;
  newcomerUserIds?: Set<string>;
}) {
  if (roots.length === 0) {
    return (
      <section className="mb-6 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/50 px-5 py-3.5">
          <Network className="h-4 w-4 text-indigo-500 shrink-0" aria-hidden />
          <h2 className="text-base font-black text-[color:var(--wp-text)]">Struktura týmu</h2>
        </div>
        <p className="px-5 py-4 text-sm text-[color:var(--wp-text-secondary)]">
          V tomto rozsahu zatím nejsou data o struktuře. Zkontrolujte nastavení nadřízených v týmu.
        </p>
      </section>
    );
  }

  return (
      <section className="mb-6 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50/40 px-6 py-4">
        <Network className="h-4 w-4 text-indigo-500 shrink-0" aria-hidden />
        <h2 className="text-lg font-black tracking-tight text-[color:var(--wp-text)]">Struktura týmu</h2>
        <span className="ml-auto text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wp-text-tertiary)]">
          {scope === "me" ? "Osobní rozsah" : `${roots.length} ${roots.length === 1 ? "kořen" : "kořenů"}`}
        </span>
      </div>

      <div className="relative overflow-hidden p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-50" />
        <div className="relative z-10 min-h-[620px] overflow-x-auto">
        <div className="mx-auto max-w-[1120px] pt-8">
          <TreeBranch
            nodes={roots}
            currentUserId={currentUserId}
            depth={0}
            memberDetailQuery={memberDetailQuery}
            selectedUserId={selectedUserId}
            onSelectMember={onSelectMember}
            metricsByUser={metricsByUser}
            newcomerUserIds={newcomerUserIds}
          />
        </div>
        </div>
      </div>
    </section>
  );
}
