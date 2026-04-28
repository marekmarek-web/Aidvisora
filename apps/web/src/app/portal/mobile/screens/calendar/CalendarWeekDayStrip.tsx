"use client";

import { formatDateLocal } from "@/app/portal/calendar/date-utils";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

/** Horizontální strip dnů aktuálního týdne (kotva = anchor). */
export function CalendarWeekDayStrip({
  weekDays,
  anchorDate,
  todayStr,
  onPickDay,
}: {
  weekDays: Date[];
  anchorDate: Date;
  todayStr: string;
  onPickDay: (d: Date) => void;
}) {
  const anchorKey = formatDateLocal(anchorDate);

  return (
    <div
      className="flex gap-2 overflow-x-auto no-scrollbar scroll-px-1 pb-1 -mx-1 px-1 snap-x snap-mandatory"
      role="tablist"
      aria-label="Dny v týdnu"
    >
      {weekDays.map((d) => {
        const key = formatDateLocal(d);
        const active = key === anchorKey;
        const isToday = key === todayStr;
        const wn = d.toLocaleDateString("cs-CZ", { month: "short" });
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPickDay(d)}
            className={cx(
              "min-h-[52px] min-w-[64px] shrink-0 snap-center rounded-2xl border px-2 py-2 text-center transition-all active:scale-[0.98]",
              active
                ? "border-indigo-300 bg-gradient-to-b from-indigo-50 to-violet-50 shadow-[var(--aidv-mobile-shadow-card-sm)]"
                : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]",
            )}
          >
            <span
              className={cx(
                "block text-[9px] font-black uppercase tracking-wide",
                isToday ? "text-indigo-600" : "text-[color:var(--wp-text-tertiary)]",
              )}
            >
              {d.toLocaleDateString("cs-CZ", { weekday: "short" })}
            </span>
            <span className="mt-0.5 block text-base font-black tabular-nums text-[#0a0f29]">{d.getDate()}</span>
            <span className="text-[10px] font-semibold text-[color:var(--wp-text-secondary)]">{wn}</span>
          </button>
        );
      })}
    </div>
  );
}
