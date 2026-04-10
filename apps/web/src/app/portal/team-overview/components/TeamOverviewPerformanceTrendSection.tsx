"use client";

import type { TeamPerformancePoint } from "@/app/actions/team-overview";

export function TeamOverviewPerformanceTrendSection({ performanceOverTime }: { performanceOverTime: TeamPerformancePoint[] }) {
  if (performanceOverTime.length === 0) return null;

  const maxUnits = Math.max(...performanceOverTime.map((x) => x.units), 1);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-[color:var(--wp-text)] mb-1">Trend výkonu (CRM)</h2>
      <p className="mb-3 text-xs text-[color:var(--wp-text-secondary)]">Jednotky po obdobích — orientační, vedle lidského přehledu výše.</p>
      <div className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-5 shadow-sm">
        <div className="flex gap-2 items-end justify-between h-32" aria-label="Graf jednotek po obdobích">
          {performanceOverTime.map((p, i) => {
            const heightPct = maxUnits > 0 ? (p.units / maxUnits) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full flex flex-col justify-end h-20 rounded-t bg-[color:var(--wp-surface-muted)] overflow-hidden">
                  <div
                    className="w-full bg-indigo-500 rounded-t transition-all"
                    style={{ height: `${heightPct}%`, minHeight: p.units > 0 ? "4px" : 0 }}
                  />
                </div>
                <span className="text-[10px] font-medium text-[color:var(--wp-text-secondary)] truncate w-full text-center" title={p.label}>
                  {p.label}
                </span>
                <span className="text-xs font-semibold text-[color:var(--wp-text-secondary)]">{p.units}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
