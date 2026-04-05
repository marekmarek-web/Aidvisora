/**
 * Garantuje, že nová FA nezačíná se starým hardcoded seznamem investic
 * (fondová knihovna / reconcile doplňuje řádky až v UI).
 */

import { describe, it, expect } from "vitest";
import { getDefaultInvestments, getDefaultState } from "../defaultState";

const LEGACY_DEFAULT_PRODUCT_KEYS = [
  "alternative",
  "creif",
  "atris",
  "penta",
  "ishares",
  "fidelity2040",
  "conseq",
] as const;

describe("defaultState (fund library / deploy gate)", () => {
  it("getDefaultInvestments returns empty array", () => {
    expect(getDefaultInvestments()).toEqual([]);
  });

  it("getDefaultState has no default investment rows", () => {
    const s = getDefaultState();
    expect(s.investments).toEqual([]);
    expect(s.investments.length).toBe(0);
  });

  it("default payload does not embed legacy hardcoded product keys", () => {
    const json = JSON.stringify(getDefaultState());
    for (const key of LEGACY_DEFAULT_PRODUCT_KEYS) {
      expect(json).not.toContain(`"productKey":"${key}"`);
    }
    expect(json).not.toContain('"productKey":"World ETF"');
    expect(json).not.toContain('"productKey":"world_etf"');
  });
});
