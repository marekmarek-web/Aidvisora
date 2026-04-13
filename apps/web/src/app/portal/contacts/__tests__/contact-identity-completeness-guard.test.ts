import { describe, it, expect } from "vitest";
import { resolveIdentityCompleteness } from "../[id]/contact-identity-completeness-logic";
import type { ContactProvenanceInput } from "../[id]/contact-identity-completeness-logic";

const baseProvenance = (overrides: Partial<NonNullable<ContactProvenanceInput>> = {}): NonNullable<ContactProvenanceInput> => ({
  reviewId: "rev-001",
  confirmedFields: [],
  autoAppliedFields: [],
  pendingFields: [],
  ...overrides,
});

/** Vrátí jen REQUIRED výsledky pro zpětnou kompatibilitu testů. */
function required(result: ReturnType<typeof resolveIdentityCompleteness>) {
  return result.filter((r) => r.category === "required");
}

describe("resolveIdentityCompleteness", () => {
  // -----------------------------------------------------------------------
  // A) Pole přítomno → vždy "ok"
  // -----------------------------------------------------------------------
  it("marks required fields ok when value is present (no provenance)", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: "1985-03-22", personalId: "850322/1234" },
      null,
    );
    expect(required(result).every((r) => r.status === "ok")).toBe(true);
  });

  it("marks field ok when value present and also in confirmedFields", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: "1985-03-22", personalId: null },
      baseProvenance({ confirmedFields: ["birthDate", "personalId"] }),
    );
    const bd = result.find((r) => r.key === "birthDate")!;
    expect(bd.status).toBe("ok");
    // personalId nemá hodnotu, ale je v confirmedFields → ok (byl zapsán jinak)
    const pid = result.find((r) => r.key === "personalId")!;
    expect(pid.status).toBe("ok");
  });

  it("marks field ok when value present and also in autoAppliedFields", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: "1985-03-22", personalId: null },
      baseProvenance({ autoAppliedFields: ["personalId"] }),
    );
    const pid = result.find((r) => r.key === "personalId")!;
    expect(pid.status).toBe("ok");
  });

  // -----------------------------------------------------------------------
  // B) Pole chybí + pending AI
  // -----------------------------------------------------------------------
  it("marks field pending_ai when missing but in pendingFields", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({ pendingFields: ["birthDate"] }),
    );
    const bd = result.find((r) => r.key === "birthDate")!;
    expect(bd.status).toBe("pending_ai");
  });

  it("marks field manual when missing and not in pendingFields", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({ pendingFields: ["birthDate"] }),
    );
    const pid = result.find((r) => r.key === "personalId")!;
    expect(pid.status).toBe("manual");
  });

  // -----------------------------------------------------------------------
  // C) Pole chybí + žádná provenance
  // -----------------------------------------------------------------------
  it("marks required fields manual when missing and provenance is null", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      null,
    );
    expect(required(result).every((r) => r.status === "manual")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // D) Prázdný string → považován jako missing
  // -----------------------------------------------------------------------
  it("treats empty string as missing for required fields", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: "", personalId: "  " },
      null,
    );
    expect(required(result).every((r) => r.status === "manual")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // E) Supporting document guard — provenance bez contactEnforcement dat
  //    = pendingFields je prázdné → nesmí generovat AI pending CTA
  // -----------------------------------------------------------------------
  it("returns manual (not pending_ai) when provenance exists but pendingFields empty (supporting doc scenario)", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({ pendingFields: [] }),
    );
    expect(required(result).every((r) => r.status === "manual")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // F) Must-pass anchor C017
  //    birthDate chybí, pendingFields má birthDate → pending_ai
  //    personalId chybí, žádný pending → manual
  // -----------------------------------------------------------------------
  it("C017 anchor: birthDate pending_ai, personalId manual", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({ pendingFields: ["birthDate"] }),
    );
    expect(result.find((r) => r.key === "birthDate")!.status).toBe("pending_ai");
    expect(result.find((r) => r.key === "personalId")!.status).toBe("manual");
  });

  // -----------------------------------------------------------------------
  // G) Must-pass anchor C029
  //    obě pole confirmed → required guard tichý
  // -----------------------------------------------------------------------
  it("C029 anchor: required fields confirmed → no required completeness alert", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: "1985-03-22", personalId: "850322/1234" },
      baseProvenance({
        confirmedFields: ["birthDate", "personalId"],
      }),
    );
    expect(required(result).every((r) => r.status === "ok")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // H) Fáze 15: Po inline confirmu — pole přejde z pending_ai do ok
  // -----------------------------------------------------------------------
  it("Phase 15: after confirm, birthDate moves to ok (appears in confirmedFields)", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({
        confirmedFields: ["birthDate"],
        pendingFields: ["personalId"],
      }),
    );
    expect(result.find((r) => r.key === "birthDate")!.status).toBe("ok");
    expect(result.find((r) => r.key === "personalId")!.status).toBe("pending_ai");
  });

  it("Phase 15: after confirming all pending fields, required guard silent (all ok)", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({
        confirmedFields: ["birthDate", "personalId"],
        pendingFields: [],
      }),
    );
    expect(required(result).every((r) => r.status === "ok")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // I) Fáze 15: Supporting docs — nesmí generovat pending_ai CTA
  // -----------------------------------------------------------------------
  it("Phase 15: C022/C040 supporting doc — no pending_ai CTA when pendingFields empty", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({
        pendingFields: [],
        autoAppliedFields: [],
        confirmedFields: [],
      }),
    );
    expect(required(result).every((r) => r.status === "manual")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // J) Must-pass anchor C030
  //    birthDate + personalId pending → oba v pending_ai
  // -----------------------------------------------------------------------
  it("C030 anchor: both identity fields pending → both pending_ai", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({ pendingFields: ["birthDate", "personalId"] }),
    );
    expect(result.find((r) => r.key === "birthDate")!.status).toBe("pending_ai");
    expect(result.find((r) => r.key === "personalId")!.status).toBe("pending_ai");
  });

  // -----------------------------------------------------------------------
  // K) manual pole nesmí dostat pending_ai status
  // -----------------------------------------------------------------------
  it("Phase 15: manual fields stay manual even when provenance/reviewId present", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({
        pendingFields: ["birthDate"],
      }),
    );
    expect(result.find((r) => r.key === "personalId")!.status).toBe("manual");
  });

  // -----------------------------------------------------------------------
  // Slice 4.2: Advisory fields
  // -----------------------------------------------------------------------
  it("advisory: idCardNumber ok when value present", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null, idCardNumber: "123456789" },
      null,
    );
    expect(result.find((r) => r.key === "idCardNumber")!.status).toBe("ok");
    expect(result.find((r) => r.key === "idCardNumber")!.category).toBe("advisory");
  });

  it("advisory: idCardNumber pending_ai when in pendingFields", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null, idCardNumber: null },
      baseProvenance({ pendingFields: ["idCardNumber"] }),
    );
    expect(result.find((r) => r.key === "idCardNumber")!.status).toBe("pending_ai");
  });

  it("advisory: idCardNumber manual when missing and no provenance", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      null,
    );
    expect(result.find((r) => r.key === "idCardNumber")!.status).toBe("manual");
  });

  it("advisory: address ok when street + city present", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null, street: "Hlavní 12", city: "Praha" },
      null,
    );
    expect(result.find((r) => r.key === "address")!.status).toBe("ok");
  });

  it("advisory: address manual when all address fields missing", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      null,
    );
    expect(result.find((r) => r.key === "address")!.status).toBe("manual");
  });

  it("advisory: address pending_ai when street in pendingFields", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      baseProvenance({ pendingFields: ["street"] }),
    );
    expect(result.find((r) => r.key === "address")!.status).toBe("pending_ai");
  });

  it("advisory: contact ok when email present", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null, email: "test@example.com" },
      null,
    );
    expect(result.find((r) => r.key === "contact")!.status).toBe("ok");
  });

  it("advisory: contact ok when phone present", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null, phone: "+420 123 456 789" },
      null,
    );
    expect(result.find((r) => r.key === "contact")!.status).toBe("ok");
  });

  it("advisory: contact manual when neither email nor phone", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: null, personalId: null },
      null,
    );
    expect(result.find((r) => r.key === "contact")!.status).toBe("manual");
  });

  it("result contains required + advisory categories", () => {
    const result = resolveIdentityCompleteness(
      { birthDate: "1985-01-01", personalId: "850101/1234", idCardNumber: "AB123456", street: "Hlavní 1", city: "Praha", zip: "110 00", email: "a@b.com" },
      null,
    );
    const categories = [...new Set(result.map((r) => r.category))];
    expect(categories).toContain("required");
    expect(categories).toContain("advisory");
    expect(result.every((r) => r.status === "ok")).toBe(true);
  });
});
