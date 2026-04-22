import { describe, expect, it } from "vitest";
import {
  renderInstitutionalAccountTemplate,
  splitContractNumberAndPrefix,
} from "../account-template";

describe("renderInstitutionalAccountTemplate", () => {
  it("Conseq template vyrenderuje se všemi placeholdery", () => {
    const result = renderInstitutionalAccountTemplate(
      "{contractPrefix}-{contractNumber}/0100",
      { contractPrefix: "107", contractNumber: "1234567890" },
    );
    expect(result.accountNumber).toBe("107-1234567890/0100");
    expect(result.missingPlaceholders).toEqual([]);
  });

  it("Conseq template s dynamickým bankCode", () => {
    const result = renderInstitutionalAccountTemplate(
      "{contractPrefix}-{contractNumber}/{bankCode}",
      { contractPrefix: "250", contractNumber: "987", bankCode: "5500" },
    );
    expect(result.accountNumber).toBe("250-987/5500");
  });

  it("vrací missingPlaceholders, když chybí contractNumber", () => {
    const result = renderInstitutionalAccountTemplate(
      "{contractPrefix}-{contractNumber}/0100",
      { contractPrefix: "107" },
    );
    expect(result.accountNumber).toBeNull();
    expect(result.missingPlaceholders).toContain("contractNumber");
  });

  it("vrací missingPlaceholders, když chybí předčíslí u Consequ", () => {
    const result = renderInstitutionalAccountTemplate(
      "{contractPrefix}-{contractNumber}/0100",
      { contractNumber: "1234567890" },
    );
    expect(result.accountNumber).toBeNull();
    expect(result.missingPlaceholders).toContain("contractPrefix");
  });

  it("prázdná šablona vrátí null bez chyby", () => {
    const result = renderInstitutionalAccountTemplate("", { contractNumber: "1" });
    expect(result.accountNumber).toBeNull();
    expect(result.missingPlaceholders).toEqual([]);
  });

  it("trimuje prázdné / whitespace placeholdery", () => {
    const result = renderInstitutionalAccountTemplate(
      "{contractPrefix}-{contractNumber}/0100",
      { contractPrefix: "  ", contractNumber: "987" },
    );
    expect(result.accountNumber).toBeNull();
    expect(result.missingPlaceholders).toContain("contractPrefix");
  });

  it("neznámý placeholder se nahlásí do missingPlaceholders", () => {
    const result = renderInstitutionalAccountTemplate(
      "{foo}-{contractNumber}/0100",
      { contractNumber: "987" },
    );
    expect(result.accountNumber).toBeNull();
    expect(result.missingPlaceholders).toContain("foo");
  });
});

describe("splitContractNumberAndPrefix", () => {
  it('rozdělí „107-123456" na prefix a číslo', () => {
    expect(splitContractNumberAndPrefix("107-1234567890")).toEqual({
      contractPrefix: "107",
      contractNumber: "1234567890",
    });
  });

  it('rozdělí i „107:123456" (dvojtečka)', () => {
    expect(splitContractNumberAndPrefix("250:98765")).toEqual({
      contractPrefix: "250",
      contractNumber: "98765",
    });
  });

  it("bez prefixu vrátí jen contractNumber", () => {
    expect(splitContractNumberAndPrefix("1234567890")).toEqual({
      contractPrefix: null,
      contractNumber: "1234567890",
    });
  });

  it("prázdný vstup vrátí obě null", () => {
    expect(splitContractNumberAndPrefix(null)).toEqual({
      contractPrefix: null,
      contractNumber: null,
    });
    expect(splitContractNumberAndPrefix("")).toEqual({
      contractPrefix: null,
      contractNumber: null,
    });
  });

  it('prefix musí být číslice — „abc-123" neparsuje', () => {
    expect(splitContractNumberAndPrefix("abc-123")).toEqual({
      contractPrefix: null,
      contractNumber: "abc-123",
    });
  });
});
