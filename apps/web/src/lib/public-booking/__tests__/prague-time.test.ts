import { describe, it, expect } from "vitest";
import { formatYmdInPrague, pragueWallToUtcMs, addDaysPragueYmd } from "../prague-time";

describe("pragueWallToUtcMs", () => {
  it("round-trips a winter date (no DST ambiguity at noon)", () => {
    const ymd = "2026-01-15";
    const ms = pragueWallToUtcMs(ymd, "10:00");
    expect(formatYmdInPrague(ms)).toBe(ymd);
    const d = new Date(ms);
    expect(d.getUTCHours()).toBe(9);
  });
});

describe("addDaysPragueYmd", () => {
  it("advances one calendar day", () => {
    expect(addDaysPragueYmd("2026-03-10", 1)).toBe("2026-03-11");
  });
});
