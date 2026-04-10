"use client";

import Link from "next/link";
import clsx from "clsx";
import { Network, UserCircle, ChevronRight } from "lucide-react";
import type { TeamOverviewScope, TeamTreeNode } from "@/lib/team-hierarchy-types";

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
}: {
  nodes: TeamTreeNode[];
  currentUserId: string;
  depth: number;
  memberDetailQuery: string;
  selectedUserId?: string | null;
  onSelectMember?: (userId: string) => void;
}) {
  return (
    <ul
      className={clsx(
        "space-y-px",
        depth > 0 &&
          "ml-4 mt-0.5 border-l-2 border-[color:var(--wp-surface-card-border)] pl-4 sm:ml-5 sm:pl-5"
      )}
    >
      {nodes.map((node) => {
        const below = countDescendants(node);
        const isSelf = node.userId === currentUserId;
        const isSelected = selectedUserId != null && selectedUserId === node.userId;
        const label = node.displayName?.trim() || node.email || "Člen týmu";
        return (
          <li key={node.userId}>
            <div
              className={clsx(
                "group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2.5 -mx-1 text-sm transition",
                isSelf && "bg-indigo-50/80 ring-1 ring-indigo-200/70",
                isSelected && !isSelf && "bg-violet-50/80 ring-1 ring-violet-200/70",
                !isSelf && !isSelected && "hover:bg-[color:var(--wp-surface-muted)]/40"
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
                    isSelected ? "text-violet-900" : isSelf ? "text-indigo-900" : "text-[color:var(--wp-text)] hover:text-indigo-600"
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
              <span className="text-[11px] text-[color:var(--wp-text-tertiary)]">{node.roleName}</span>
              {below > 0 && (
                <span className="rounded-full bg-[color:var(--wp-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--wp-text-secondary)]">
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
            {node.children.length > 0 && (
              <TreeBranch
                nodes={node.children}
                currentUserId={currentUserId}
                depth={depth + 1}
                memberDetailQuery={memberDetailQuery}
                selectedUserId={selectedUserId}
                onSelectMember={onSelectMember}
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
}: {
  roots: TeamTreeNode[];
  currentUserId: string;
  scope: TeamOverviewScope;
  memberDetailQuery?: string;
  hierarchyParentLinksConfigured?: boolean;
  selectedUserId?: string | null;
  onSelectMember?: (userId: string) => void;
}) {
  const selfNode = findNodeInForest(roots, currentUserId);
  const directChildren = selfNode?.children ?? [];

  if (roots.length === 0) {
    return (
      <section className="mb-6 overflow-hidden rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] shadow-sm">
        <div className="flex items-center gap-2 border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50 px-5 py-3">
          <Network className="h-4 w-4 text-indigo-500 shrink-0" aria-hidden />
          <h2 className="text-base font-black text-[color:var(--wp-text)]">Struktura týmu</h2>
        </div>
        <p className="px-5 py-4 text-sm text-[color:var(--wp-text-secondary)]">
          V tomto rozsahu zatím nejsou data o struktuře. Zkontrolujte nastavení nadřízených v týmu.
        </p>
      </section>
    );
  }

  const isPersonalOnly = scope === "me";

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50 px-5 py-3">
        <Network className="h-4 w-4 text-indigo-500 shrink-0" aria-hidden />
        <h2 className="text-base font-black text-[color:var(--wp-text)]">Struktura týmu</h2>
        <span className="ml-auto text-[11px] text-[color:var(--wp-text-tertiary)]">
          {isPersonalOnly ? "Osobní rozsah" : `${roots.length} ${roots.length === 1 ? "kořen" : "kořenů"}`}
        </span>
      </div>

      <div className="p-5">
        {isPersonalOnly && (
          <p className="mb-4 text-xs text-[color:var(--wp-text-secondary)]">
            Zobrazujete osobní rozsah — širší přehled je dostupný v přepínači rozsahu podle vaší role.
          </p>
        )}

        {!isPersonalOnly && !hierarchyParentLinksConfigured && (
          <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-amber-950">
            <span className="font-semibold">Vazby nadřízenosti zatím chybí.</span>{" "}
            Strom může zobrazit všechny jako samostatné kořeny — jde o data, ne o chybu. Doplňte v Nastavení → Tým.
          </div>
        )}

        {/* Přímí podřízení */}
        {!isPersonalOnly && directChildren.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
              Přímí podřízení
            </p>
            <div className="flex flex-wrap gap-2">
              {directChildren.map((c) => {
                const isChildSelected = selectedUserId === c.userId;
                return (
                  <span key={c.userId} className="inline-flex items-center gap-1.5">
                    {onSelectMember ? (
                      <button
                        type="button"
                        onClick={() => onSelectMember(c.userId)}
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                          isChildSelected
                            ? "border-violet-300 bg-violet-50/80 text-violet-900"
                            : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text)] hover:border-indigo-200 hover:bg-indigo-50/50"
                        )}
                      >
                        {c.displayName?.trim() || c.email || "Člen týmu"}
                      </button>
                    ) : (
                      <Link
                        href={`/portal/team-overview/${c.userId}${memberDetailQuery}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--wp-text)] hover:border-indigo-200 hover:bg-indigo-50/50 transition"
                      >
                        {c.displayName?.trim() || c.email || "Člen týmu"}
                      </Link>
                    )}
                    <Link
                      href={`/portal/team-overview/${c.userId}${memberDetailQuery}`}
                      className="inline-flex items-center text-[10px] font-semibold text-indigo-600 hover:underline"
                    >
                      <ChevronRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Strom */}
        <div className="max-h-[min(22rem,52vh)] overflow-y-auto pr-1 -mr-1">
          <TreeBranch
            nodes={roots}
            currentUserId={currentUserId}
            depth={0}
            memberDetailQuery={memberDetailQuery}
            selectedUserId={selectedUserId}
            onSelectMember={onSelectMember}
          />
        </div>
      </div>
    </section>
  );
}
