import { describe, expect, it } from "vitest";
import {
  digitsFromCzDateInput,
  formatCzDate,
  formatCzDateFromDigits,
  normalizeDateForApi,
  parseCzDateToIso,
  validateCzDateComplete,
} from "../cz-date";

describe("formatCzDateFromDigits", () => {
  it("builds progressive CZ display with variable month width", () => {
    expect(formatCzDateFromDigits("1")).toBe("1");
    expect(formatCzDateFromDigits("13")).toBe("13");
    expect(formatCzDateFromDigits("139")).toBe("13. 9");
    expect(formatCzDateFromDigits("1392")).toBe("13. 9. 2");
    expect(formatCzDateFromDigits("1392026")).toBe("13. 9. 2026");
  });

  it("supports zero-padded month", () => {
    expect(formatCzDateFromDigits("13092026")).toBe("13. 9. 2026");
  });

  it("caps at 8 digits", () => {
    expect(formatCzDateFromDigits("13092026123")).toBe("13. 9. 2026");
  });
});

describe("formatCzDate / parseCzDateToIso", () => {
  it("roundtrips ISO", () => {
    expect(formatCzDate("2026-09-13")).toBe("13. 9. 2026");
    expect(parseCzDateToIso("13. 9. 2026")).toBe("2026-09-13");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseCzDateToIso("31. 2. 2026")).toBeNull();
    expect(parseCzDateToIso("32. 1. 2026")).toBeNull();
  });

  it("normalizeDateForApi matches parse", () => {
    expect(normalizeDateForApi("1. 12. 2024")).toBe("2024-12-01");
  });
});

describe("digitsFromCzDateInput", () => {
  it("strips non-digits", () => {
    expect(digitsFromCzDateInput("13. 9. 2026")).toBe("1392026");
  });
});

describe("validateCzDateComplete", () => {
  it("accepts valid", () => {
    const r = validateCzDateComplete("13. 9. 2026");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe("2026-09-13");
  });

  it("rejects incomplete", () => {
    const r = validateCzDateComplete("13. 9.");
    expect(r.ok).toBe(false);
  });
});
