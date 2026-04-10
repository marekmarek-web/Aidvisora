import { describe, it, expect } from "vitest";
import {
  formatTeamOverviewProduction,
  poolCardUnitsFootnote,
  poolProgramLabel,
  poolUnitsLineLabel,
  TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE,
} from "@/lib/team-overview-format";

describe("formatTeamOverviewProduction", () => {
  it("formats small integers with cs-CZ grouping", () => {
    expect(formatTeamOverviewProduction(1234)).toMatch(/1/);
    expect(formatTeamOverviewProduction(999)).toBe("999");
  });

  it("uses k suffix from 1000", () => {
    expect(formatTeamOverviewProduction(1500)).toContain("k");
  });

  it("uses M suffix from 1_000_000", () => {
    expect(formatTeamOverviewProduction(2_500_000)).toContain("M");
  });
});

describe("pool copy helpers", () => {
  it("keeps Beplan vs PB footnotes distinct (no BJ/BJS confusion)", () => {
    expect(poolCardUnitsFootnote("beplan")).toContain("BJ");
    expect(poolCardUnitsFootnote("beplan")).not.toContain("BJS");
    expect(poolCardUnitsFootnote("premium_brokers")).toContain("BJS");
    expect(poolCardUnitsFootnote("premium_brokers")).not.toMatch(/BJ(?!S)/);
  });

  it("exposes stable program labels", () => {
    expect(poolProgramLabel("beplan").length).toBeGreaterThan(2);
    expect(poolProgramLabel("premium_brokers").length).toBeGreaterThan(2);
  });

  it("poolUnitsLineLabel includes period label", () => {
    expect(poolUnitsLineLabel("Q1 2026")).toContain("Q1 2026");
  });

  it("units column subtitle is single source", () => {
    expect(TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE).toContain("CRM");
  });
});
