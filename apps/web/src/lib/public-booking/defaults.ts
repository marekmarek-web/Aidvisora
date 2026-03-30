import type { BookingWeeklyAvailability } from "db";

export function defaultBookingAvailability(): BookingWeeklyAvailability {
  const day = [{ start: "09:00", end: "17:00" }];
  return {
    "1": [...day],
    "2": [...day],
    "3": [...day],
    "4": [...day],
    "5": [...day],
  };
}

export function normalizeAvailability(raw: unknown): BookingWeeklyAvailability | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: BookingWeeklyAvailability = {};
  for (const key of Object.keys(o)) {
    if (!/^[1-7]$/.test(key)) continue;
    const arr = o[key];
    if (!Array.isArray(arr)) continue;
    const windows: { start: string; end: string }[] = [];
    for (const w of arr) {
      if (!w || typeof w !== "object") continue;
      const start = String((w as { start?: string }).start ?? "").trim();
      const end = String((w as { end?: string }).end ?? "").trim();
      if (/^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end)) {
        windows.push({ start, end });
      }
    }
    if (windows.length) out[key] = windows;
  }
  return Object.keys(out).length ? out : null;
}
