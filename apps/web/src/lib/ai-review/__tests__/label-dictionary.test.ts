import { describe, it, expect } from "vitest";
import {
  labelDocType,
  labelProductFamily,
  labelFieldKey,
  labelFundCategory,
  labelFvSourceType,
  humanizeMissingField,
  humanizeManualNeeded,
} from "../label-dictionary";

describe("labelDocType", () => {
  it("maps known types to Czech", () => {
    expect(labelDocType("contract")).toBe("Smlouva");
    expect(labelDocType("investment_contract")).toBe("Investiční smlouva");
    expect(labelDocType("payment_instructions")).toBe("Platební pokyny");
    expect(labelDocType("unknown")).toBe("Jiný dokument");
  });

  it("returns safe fallback for unknown types, never raw string", () => {
    const result = labelDocType("some_weird_internal_type_v3");
    expect(result).not.toContain("some_weird");
    expect(result).toMatch(/[áčďéěíňóřšťúůýž]/i);
  });

  it("returns Neurčeno for empty input", () => {
    expect(labelDocType("")).toBe("Neurčeno");
    expect(labelDocType("  ")).toBe("Neurčeno");
  });
});

describe("labelProductFamily", () => {
  it("maps known families to Czech", () => {
    expect(labelProductFamily("life_insurance")).toBe("Životní pojištění");
    expect(labelProductFamily("investment")).toBe("Investice");
    expect(labelProductFamily("dps")).toBe("Doplňkové penzijní spoření (DPS)");
  });

  it("returns safe fallback for unknown families", () => {
    const result = labelProductFamily("crypto_derivatives");
    expect(result).not.toContain("crypto");
  });
});

describe("labelFieldKey", () => {
  it("maps identity fields to Czech", () => {
    expect(labelFieldKey("idCardNumber")).toBe("Číslo dokladu / OP");
    expect(labelFieldKey("idCardIssuedBy")).toBe("Doklad vydal");
    expect(labelFieldKey("idCardValidUntil")).toBe("Platnost dokladu do");
    expect(labelFieldKey("generalPractitioner")).toBe("Praktický lékař");
  });

  it("maps contract fields to Czech", () => {
    expect(labelFieldKey("contractStartDate")).toBe("Počátek smlouvy");
    expect(labelFieldKey("policyholder")).toBe("Pojistník");
    expect(labelFieldKey("investmentFunds")).toBe("Fondy");
  });

  it("maps fund resolution fields to Czech", () => {
    expect(labelFieldKey("resolvedFundId")).toBe("Fond (dle knihovny)");
    expect(labelFieldKey("resolvedFundCategory")).toBe("Kategorie fondu");
    expect(labelFieldKey("fvSourceType")).toBe("Zdroj pro výpočet FV");
  });

  it("never returns raw English key for unknown fields", () => {
    const result = labelFieldKey("someRandomInternalField");
    expect(result).not.toContain("someRandom");
    expect(result).toBe("Údaj k ověření");
  });
});

describe("labelFundCategory", () => {
  it("maps known categories to Czech", () => {
    expect(labelFundCategory("equity")).toBe("Akcie");
    expect(labelFundCategory("balanced")).toBe("Vyvážený");
    expect(labelFundCategory("conservative")).toBe("Konzervativní");
    expect(labelFundCategory("real_estate")).toBe("Nemovitostní fond");
    expect(labelFundCategory("dps_dynamic")).toBe("DPS dynamický");
  });

  it("returns Nezařazeno for unknown", () => {
    expect(labelFundCategory("")).toBe("Nezařazeno");
    expect(labelFundCategory("moon_fund")).toBe("Nezařazeno");
  });
});

describe("labelFvSourceType", () => {
  it("maps known source types", () => {
    expect(labelFvSourceType("fund-library")).toBe("Fond z knihovny");
    expect(labelFvSourceType("heuristic-fallback")).toBe("Odhad dle kategorie");
    expect(labelFvSourceType("manual")).toBe("Ruční zadání");
  });

  it("handles null/undefined", () => {
    expect(labelFvSourceType(null)).toBe("Neznámý zdroj");
    expect(labelFvSourceType(undefined)).toBe("Neznámý zdroj");
  });
});

describe("humanizeMissingField", () => {
  it("creates human-readable Czech message for known fields", () => {
    expect(humanizeMissingField("idCardNumber")).toBe("Číslo dokladu / OP — nenalezeno v dokumentu");
    expect(humanizeMissingField("generalPractitioner")).toBe("Praktický lékař — nenalezeno v dokumentu");
  });

  it("creates safe fallback for unknown fields", () => {
    expect(humanizeMissingField("randomInternalKey")).toBe("Údaj nebyl v dokumentu nalezen");
  });
});

describe("humanizeManualNeeded", () => {
  it("creates human-readable Czech message for known fields", () => {
    expect(humanizeManualNeeded("idCardValidUntil")).toBe("Platnost dokladu do — doplňte ručně");
  });
});
