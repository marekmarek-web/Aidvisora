import { describe, it, expect } from "vitest";
import { resolveInstitutionLogo, institutionInitials } from "../institution-logo";

describe("resolveInstitutionLogo — word-boundary matching", () => {
  it("matches NN as a standalone word", () => {
    expect(resolveInstitutionLogo("NN Investment Partners")?.alt).toBe("NN");
    expect(resolveInstitutionLogo("Nationale Nederlanden")?.alt).toBe("NN");
    expect(resolveInstitutionLogo("NN")?.alt).toBe("NN");
  });

  it("does not hallucinate NN logo inside unrelated Czech words", () => {
    // „cennými" obsahuje „nn" jako substring — nesmí matchnout NN
    expect(
      resolveInstitutionLogo("EFEKTA obchodník s cennými papíry a.s.")
    ).toBeNull();
    expect(resolveInstitutionLogo("Penny Market")).toBeNull();
  });

  it("matches short bank/insurance abbreviations only as whole words", () => {
    expect(resolveInstitutionLogo("KB")?.alt).toBe("KB");
    expect(resolveInstitutionLogo("Komerční banka")?.alt).toBe("KB");
    // „Kbely" začíná na „kb", ale není to standalone slovo → žádný match
    expect(resolveInstitutionLogo("Kbely Reality s.r.o.")).toBeNull();
  });

  it("is diacritics-insensitive", () => {
    expect(resolveInstitutionLogo("Česká spořitelna")?.alt).toBe("Česká spořitelna");
    expect(resolveInstitutionLogo("Ceska sporitelna")?.alt).toBe("Česká spořitelna");
    expect(resolveInstitutionLogo("ČSOB pojišťovna")?.alt).toBe("ČSOB");
  });

  it("returns null for unknown institutions", () => {
    expect(resolveInstitutionLogo(null)).toBeNull();
    expect(resolveInstitutionLogo("")).toBeNull();
    expect(resolveInstitutionLogo("Zcela neznámá instituce s.r.o.")).toBeNull();
  });
});

describe("institutionInitials", () => {
  it("produces up to 2-char initials", () => {
    expect(institutionInitials("Allianz")).toBe("AL");
    expect(institutionInitials("Česká spořitelna")).toBe("ČS");
    expect(institutionInitials(null)).toBe("?");
  });
});
