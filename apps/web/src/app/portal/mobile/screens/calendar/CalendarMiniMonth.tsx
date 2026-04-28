"use client";

import { formatDateLocal } from "@/app/portal/calendar/date-utils";
import { MONTH_NAMES, addDaysLocal, startOfDayLocal, startOfWeekLocal } from "./calendar-utils";

export function CalendarMiniMonth({
  anchorDate,
  firstDayOfWeek,
  todayStr,
  onPickDay,
  eventDotsByDay,
}: {
  anchorDate: Date;
  firstDayOfWeek: 0 | 1;
  todayStr: string;
  onPickDay: (d: Date) => void;
  /** počet aktivit daného kalendářního dne (pro vizuální tečky) */
  eventDotsByDay?: Record<string, number>;
}) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeekLocal(monthStart, firstDayOfWeek);
  const label = `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  const dayLabels =
    firstDayOfWeek === 1 ? (["Po", "Út", "St", "Čt", "Pá", "So", "Ne"] as const) : (["Ne", "Po", "Út", "St", "Čt", "Pá", "So"] as const);

  const cells = Array.from({ length: 42 }, (_, i) => addDaysLocal(gridStart, i));

  return (
    <div className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50 p-3 shadow-[var(--aidv-mobile-shadow-card-premium,var(--aidv-shadow-card-sm))]">
      <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">{label}</p>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-[color:var(--wp-text-tertiary)]">
        {dayLabels.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const ds = formatDateLocal(d);
          const inMonth = d.getMonth() === anchorDate.getMonth();
          const isToday = ds === todayStr;
          const isAnchor = ds === formatDateLocal(startOfDayLocal(anchorDate));
          const n = eventDotsByDay?.[ds] ?? 0;
          const dots = Math.min(Math.max(n, 0), 4);
          return (
            <button
              key={ds}
              type="button"
              onClick={() => onPickDay(startOfDayLocal(d))}
              className={`relative flex min-h-[2.65rem] flex-col items-center justify-center gap-0.5 rounded-lg pt-1 text-xs font-bold transition-colors active:scale-95 ${
                !inMonth ? "text-[color:var(--wp-text-tertiary)]" : "text-[color:var(--wp-text-secondary)]"
              } ${
                isToday
                  ? "bg-indigo-600 text-white shadow-sm"
                  : isAnchor
                    ? "bg-indigo-100 text-indigo-800"
                    : inMonth
                      ? "bg-[color:var(--wp-surface-card)] hover:bg-[color:var(--wp-surface-muted)]"
                      : ""
              }`}
            >
              {d.getDate()}
              {dots > 0 ? (
                <span className="flex h-3 items-center gap-px" aria-hidden>
                  {Array.from({ length: dots }).map((_, i) => (
                    <span
                      key={`${ds}-${i}`}
                      className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 opacity-95"
                    />
                  ))}
                </span>
              ) : (
                <span className="h-3" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
