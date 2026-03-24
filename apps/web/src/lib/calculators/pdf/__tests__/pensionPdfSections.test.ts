import { describe, expect, it } from "vitest";
import { buildPensionPdfSections } from "../pensionPdfSections";
import type { PensionResult, PensionState } from "../../pension/pension.types";

describe("buildPensionPdfSections", () => {
  it("maps state and result into two sections", () => {
    const state: PensionState = {
      age: 35,
      retireAge: 65,
      salary: 45_000,
      rent: 35_000,
      scenario: "realistic",
    };
    const result: PensionResult = {
      estimatedPension: 14_000,
      monthlyGap: 21_000,
      monthlyInvestment: 3800,
      targetCapital: 3_380_000,
    };
    const sections = buildPensionPdfSections(state, result);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.title).toBe("Vstupy");
    expect(sections[1]?.title).toBe("Výsledky (orientační)");
    const labels = sections.flatMap((s) => s.rows.map((r) => r.label));
    expect(labels).toContain("Scénář");
    expect(sections[0]?.rows.find((r) => r.label === "Scénář")?.value).toBe("Realistický");
    expect(labels).toContain("Odhadovaný státní důchod");
  });
});
