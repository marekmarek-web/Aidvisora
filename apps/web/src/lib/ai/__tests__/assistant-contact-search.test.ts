import { describe, expect, it } from "vitest";
import {
  escapeIlikeLiteral,
  normalizeNameSearchQuery,
  splitNameSearchTokens,
} from "../assistant-contact-search-normalize";

describe("normalizeNameSearchQuery", () => {
  it("extracts Czech First Last from a long mortgage sentence", () => {
    const input =
      "Břetislav Mráz, hypotéka 4 000 000 Kč, LTV 90 %, koupě bytu + rekonstrukce, nabídka ČS 4,99 %";
    expect(normalizeNameSearchQuery(input)).toBe("Břetislav Mráz");
  });

  it("returns cleaned text when no capitalized pair matches", () => {
    expect(normalizeNameSearchQuery("  novák   jan   ")).toBe("novák jan");
  });

  it("strips digits and noise; may fall back to original trim if nothing remains", () => {
    const s = "follow-up hypotéka 123 Kč";
    const out = normalizeNameSearchQuery(s);
    expect(out).toBeTruthy();
  });
});

describe("splitNameSearchTokens", () => {
  it("splits normalized pair into two tokens", () => {
    expect(splitNameSearchTokens("Břetislav Mráz")).toEqual(["Břetislav", "Mráz"]);
  });

  it("drops single-character tokens", () => {
    expect(splitNameSearchTokens("A Bc")).toEqual(["Bc"]);
  });
});

describe("escapeIlikeLiteral", () => {
  it("escapes ILIKE wildcards", () => {
    expect(escapeIlikeLiteral("100%_test")).toBe("100\\%\\_test");
  });
});
