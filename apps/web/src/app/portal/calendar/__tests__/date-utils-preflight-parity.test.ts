/**
 * P4: planner preflight and createEventAction must agree on “ISO with explicit offset”.
 */
import { describe, it, expect } from "vitest";
import { hasExplicitIsoOffset } from "../date-utils";
import { computeWriteStepPreflight } from "@/lib/ai/assistant-execution-plan";

const CONTACT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("date-utils hasExplicitIsoOffset vs execution preflight", () => {
  it.each([
    ["2026-04-10T14:30:00.000Z", true],
    ["2026-04-10T14:30:00+01:00", true],
    ["2026-04-10T14:30:00-05:00", true],
    ["2026-04-10T14:30:00+0500", true],
    ["2026-04-10T14:30:00", false],
    ["2026-04-10", false],
    ["", false],
  ])("hasExplicitIsoOffset(%s) === %s", (iso, expected) => {
    expect(hasExplicitIsoOffset(iso)).toBe(expected);
  });

  it("when hasExplicitIsoOffset is false, computeWriteStepPreflight blocks schedule step", () => {
    const bad = "2026-04-10T14:30:00";
    expect(hasExplicitIsoOffset(bad)).toBe(false);
    const r = computeWriteStepPreflight("scheduleCalendarEvent", {
      contactId: CONTACT,
      startAt: bad,
    });
    expect(r.preflightStatus).toBe("blocked");
  });

  it("when hasExplicitIsoOffset is true, preflight is ready (other fields satisfied)", () => {
    const good = "2026-04-10T14:30:00.000Z";
    expect(hasExplicitIsoOffset(good)).toBe(true);
    const r = computeWriteStepPreflight("scheduleCalendarEvent", {
      contactId: CONTACT,
      startAt: good,
    });
    expect(r.preflightStatus).toBe("ready");
  });
});
