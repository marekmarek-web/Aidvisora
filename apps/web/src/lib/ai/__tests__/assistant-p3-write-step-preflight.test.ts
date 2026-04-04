/**
 * P3: strict preflight (ISO datetime with TZ, coverage status) — same rules as planner / history mapper.
 */
import { describe, it, expect } from "vitest";
import { computeWriteStepPreflight } from "../assistant-execution-plan";

const CONTACT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("P3 computeWriteStepPreflight — scheduleCalendarEvent", () => {
  it("needs_input for date-only YYYY-MM-DD (startAt)", () => {
    const r = computeWriteStepPreflight("scheduleCalendarEvent", {
      contactId: CONTACT,
      startAt: "2026-04-10",
    });
    expect(r.preflightStatus).toBe("needs_input");
    expect(r.advisorMessage).toMatch(/čas|ISO/i);
  });

  it("needs_input for date-only via resolvedDate", () => {
    const r = computeWriteStepPreflight("scheduleCalendarEvent", {
      contactId: CONTACT,
      resolvedDate: "2026-04-10",
    });
    expect(r.preflightStatus).toBe("needs_input");
  });

  it("blocked for datetime without explicit timezone offset", () => {
    const r = computeWriteStepPreflight("scheduleCalendarEvent", {
      contactId: CONTACT,
      startAt: "2026-04-10T14:30:00",
    });
    expect(r.preflightStatus).toBe("blocked");
    expect(r.advisorMessage).toMatch(/časovou zón|offset|Z|±/i);
  });

  it("ready for ISO with Z", () => {
    const r = computeWriteStepPreflight("scheduleCalendarEvent", {
      contactId: CONTACT,
      startAt: "2026-04-10T14:30:00.000Z",
    });
    expect(r.preflightStatus).toBe("ready");
    expect(r.missingFields).toHaveLength(0);
  });

  it("ready for ISO with numeric offset +01:00", () => {
    const r = computeWriteStepPreflight("scheduleCalendarEvent", {
      contactId: CONTACT,
      startAt: "2026-04-10T14:30:00+01:00",
    });
    expect(r.preflightStatus).toBe("ready");
  });
});

describe("P3 computeWriteStepPreflight — upsertContactCoverage", () => {
  it("blocked for invalid coverage status string", () => {
    const r = computeWriteStepPreflight("upsertContactCoverage", {
      contactId: CONTACT,
      itemKey: "ODP",
      status: "totally_invalid",
    });
    expect(r.preflightStatus).toBe("blocked");
    expect(r.advisorMessage).toMatch(/Neplatný|stav/i);
  });
});
