import { describe, expect, it } from "vitest";
import { parseIsoYmd, suggestedAnniversaryFromContractStart } from "../suggested-anniversary-from-contract-start";

describe("parseIsoYmd", () => {
  it("parses valid ISO date", () => {
    expect(parseIsoYmd("2023-10-10")).toEqual({ y: 2023, m: 10, d: 10 });
  });

  it("rejects invalid", () => {
    expect(parseIsoYmd("")).toBeNull();
    expect(parseIsoYmd("10.10.2023")).toBeNull();
  });
});

describe("suggestedAnniversaryFromContractStart", () => {
  it("uses current year when anniversary is still ahead", () => {
    const now = new Date(2026, 3, 8);
    expect(suggestedAnniversaryFromContractStart("2023-10-10", now)).toBe("2026-10-10");
  });

  it("rolls to next year when this years anniversary passed", () => {
    const now = new Date(2026, 11, 1);
    expect(suggestedAnniversaryFromContractStart("2020-10-10", now)).toBe("2027-10-10");
  });

  it("handles Feb 29 on non-leap year as Feb 28", () => {
    const now = new Date(2025, 0, 1);
    expect(suggestedAnniversaryFromContractStart("2024-02-29", now)).toBe("2025-02-28");
  });
});
