/** Europe/Prague wall-clock helpers for public booking slots (no extra deps). */

export const BOOKING_TIMEZONE = "Europe/Prague";

const formatterYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatterHm = new Intl.DateTimeFormat("en-GB", {
  timeZone: BOOKING_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const weekdayLong = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIMEZONE,
  weekday: "long",
});

const ISO_DOW: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

export function formatYmdInPrague(ms: number): string {
  return formatterYmd.format(new Date(ms));
}

export function formatHmInPrague(ms: number): string {
  const s = formatterHm.format(new Date(ms));
  return s.replace(/\s/g, "");
}

/** ISO weekday 1–7 (Mon–Sun) for instant `ms` in Europe/Prague calendar date. */
export function isoWeekdayInPrague(ms: number): number {
  const w = weekdayLong.format(new Date(ms));
  return ISO_DOW[w] ?? 1;
}

/**
 * UTC instant for local wall time `hh:mm` on calendar date `ymd` (YYYY-MM-DD) in Europe/Prague.
 */
export function pragueWallToUtcMs(ymd: string, hhmm: string): number {
  const [y, mo, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const [hh, mm] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    throw new Error("Invalid ymd");
  }
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    throw new Error("Invalid time");
  }

  let ms = Date.UTC(y, mo - 1, d, hh - 3, mm, 0, 0);
  for (let i = 0; i < 480; i++) {
    if (formatYmdInPrague(ms) !== ymd) {
      ms += 60 * 1000;
      continue;
    }
    const hm = formatHmInPrague(ms);
    const parts = hm.split(":");
    const ph = parseInt(parts[0] ?? "0", 10);
    const pm = parseInt(parts[1] ?? "0", 10);
    if (ph === hh && pm === mm) return ms;
    ms += 60 * 1000;
  }

  throw new Error("Could not resolve Prague wall time");
}

export function parseHm(hm: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

export function minutesSinceMidnight(hm: string): number | null {
  const p = parseHm(hm);
  if (!p) return null;
  return p.h * 60 + p.m;
}

/** Next calendar date (YYYY-MM-DD) in Europe/Prague after `ymd`. */
export function addDaysPragueYmd(ymd: string, delta: number): string {
  let cur = ymd;
  const sign = delta >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(delta); i++) {
    const noon = pragueWallToUtcMs(cur, "12:00");
    cur = formatYmdInPrague(noon + sign * 24 * 60 * 60 * 1000);
  }
  return cur;
}
