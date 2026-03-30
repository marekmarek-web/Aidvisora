import type { BookingWeeklyAvailability } from "db";
import {
  addDaysPragueYmd,
  formatYmdInPrague,
  isoWeekdayInPrague,
  minutesSinceMidnight,
  pragueWallToUtcMs,
} from "./prague-time";

export type BusyInterval = { startMs: number; endMs: number };

const MAX_SLOTS = 250;

export function expandBusyIntervals(busy: BusyInterval[], bufferMinutes: number): BusyInterval[] {
  const bufMs = Math.max(0, bufferMinutes) * 60 * 1000;
  return busy.map((b) => ({
    startMs: b.startMs - bufMs,
    endMs: b.endMs + bufMs,
  }));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Free slots as UTC ISO instants, sorted, capped.
 */
export function computeAvailableSlots(params: {
  fromYmd: string;
  numDays: number;
  availability: BookingWeeklyAvailability;
  slotMinutes: number;
  bufferMinutes: number;
  busy: BusyInterval[];
  nowMs: number;
  minLeadMinutes: number;
}): { start: string; end: string }[] {
  const {
    fromYmd,
    numDays,
    availability,
    slotMinutes,
    bufferMinutes,
    busy,
    nowMs,
    minLeadMinutes,
  } = params;

  const slotMs = Math.max(15, Math.min(120, slotMinutes)) * 60 * 1000;
  const leadMs = Math.max(0, minLeadMinutes) * 60 * 1000;
  const minStart = nowMs + leadMs;

  const expanded = expandBusyIntervals(busy, bufferMinutes);
  const out: { start: string; end: string }[] = [];

  let ymd = fromYmd;
  for (let d = 0; d < numDays; d++) {
    const noonMs = pragueWallToUtcMs(ymd, "12:00");
    const isoD = isoWeekdayInPrague(noonMs);
    const windows = availability[String(isoD)] ?? [];

    for (const { start: wStart, end: wEnd } of windows) {
      const startM = minutesSinceMidnight(wStart);
      const endM = minutesSinceMidnight(wEnd);
      if (startM == null || endM == null || endM <= startM) continue;

      for (let m = startM; m + slotMinutes <= endM; m += slotMinutes) {
        const hh = Math.floor(m / 60);
        const mm = m % 60;
        const hm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        let slotStartMs: number;
        try {
          slotStartMs = pragueWallToUtcMs(ymd, hm);
        } catch {
          continue;
        }
        const slotEndMs = slotStartMs + slotMs;
        if (slotEndMs <= minStart) continue;

        const blocked = expanded.some((b) => overlaps(slotStartMs, slotEndMs, b.startMs, b.endMs));
        if (blocked) continue;

        out.push({
          start: new Date(slotStartMs).toISOString(),
          end: new Date(slotEndMs).toISOString(),
        });
        if (out.length >= MAX_SLOTS) return out.sort((a, b) => a.start.localeCompare(b.start));
      }
    }

    ymd = addDaysPragueYmd(ymd, 1);
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Today YYYY-MM-DD in Europe/Prague. */
export function todayYmdPrague(nowMs: number): string {
  return formatYmdInPrague(nowMs);
}
