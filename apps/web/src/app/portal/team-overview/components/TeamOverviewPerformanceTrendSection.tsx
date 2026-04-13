"use client";

import type { TeamPerformancePoint } from "@/app/actions/team-overview";

export function TeamOverviewPerformanceTrendSection({ performanceOverTime }: { performanceOverTime: TeamPerformancePoint[] }) {
  if (performanceOverTime.length === 0) return null;

  const maxUnits = Math.max(...performanceOverTime.map((x) => x.units), 1);

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-black tracking-tight text-[color:var(--wp-text)]">Trend výkonu (CRM)</h2>
      <p className="mb-3 text-sm text-[color:var(--wp-text-secondary)]">Jednotky po obdobích jako rychlá orientace vedle detailního přehledu výše.</p>
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex gap-2 items-end justify-between h-32" aria-label="Graf jednotek po obdobích">
          {performanceOverTime.map((p, i) => {
            const heightPct = maxUnits > 0 ? (p.units / maxUnits) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="flex h-20 w-full flex-col justify-end overflow-hidden rounded-t-2xl bg-slate-100">
                  <div
                    className="w-full rounded-t-2xl bg-indigo-500 transition-all duration-300"
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
