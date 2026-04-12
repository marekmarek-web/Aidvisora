/**
 * F9: Regression coverage pro sdílenou F7 provenanci identity polí (desktop + mobile).
 * Obecné scénáře — žádná vazba na konkrétní PDF nebo anchor.
 */
import { describe, it, expect } from "vitest";
import {
  resolveContactIdentityFieldProvenance,
  shouldShowContactIdentityRow,
} from "../contact-identity-field-provenance";
import type { ContactAiProvenanceResult } from "@/app/actions/contacts";

function baseProvenance(
  overrides: Partial<NonNullable<ContactAiProvenanceResult>> = {},
): ContactAiProvenanceResult {
  return {
    reviewId: "rev-f9",
    appliedAt: "2026-04-12T12:00:00.000Z",
    confirmedFields: [],
    autoAppliedFields: [],
    pendingFields: [],
    manualRequiredFields: [],
    mergeConflictFields: [],
    ...overrides,
  };
}

describe("resolveContactIdentityFieldProvenance", () => {
  it("returns confirmed when field in confirmedFields", () => {
    const p = resolveContactIdentityFieldProvenance(
      "birthDate",
      baseProvenance({ confirmedFields: ["birthDate"] }),
    );
    expect(p?.kind).toBe("confirmed");
    expect(p?.reviewId).toBe("rev-f9");
  });

  it("returns auto_applied when in autoAppliedFields", () => {
    const p = resolveContactIdentityFieldProvenance(
      "email",
      baseProvenance({ autoAppliedFields: ["email"] }),
    );
    expect(p?.kind).toBe("auto_applied");
  });

  it("returns pending_review when in pendingFields", () => {
    const p = resolveContactIdentityFieldProvenance(
      "personalId",
      baseProvenance({ pendingFields: ["personalId"] }),
    );
    expect(p?.kind).toBe("pending_review");
  });

  it("returns manual when in manualRequiredFields", () => {
    const p = resolveContactIdentityFieldProvenance(
      "idCardNumber",
      baseProvenance({ manualRequiredFields: ["idCardNumber"] }),
    );
    expect(p?.kind).toBe("manual");
  });

  it("prefers confirmed over auto_applied when both present", () => {
    const p = resolveContactIdentityFieldProvenance(
      "birthDate",
      baseProvenance({
        confirmedFields: ["birthDate"],
        autoAppliedFields: ["birthDate"],
      }),
    );
    expect(p?.kind).toBe("confirmed");
  });

  it("returns null when no provenance", () => {
    expect(resolveContactIdentityFieldProvenance("birthDate", null)).toBeNull();
  });

  it("returns null when field has no provenance entry", () => {
    expect(
      resolveContactIdentityFieldProvenance("birthDate", baseProvenance({})),
    ).toBeNull();
  });
});

describe("shouldShowContactIdentityRow", () => {
  it("shows row when value present", () => {
    expect(shouldShowContactIdentityRow("birthDate", true, null)).toBe(true);
  });

  it("shows row when pending_review without value", () => {
    expect(
      shouldShowContactIdentityRow(
        "birthDate",
        false,
        baseProvenance({ pendingFields: ["birthDate"] }),
      ),
    ).toBe(true);
  });

  it("shows row when manual without value", () => {
    expect(
      shouldShowContactIdentityRow(
        "personalId",
        false,
        baseProvenance({ manualRequiredFields: ["personalId"] }),
      ),
    ).toBe(true);
  });

  it("hides row when no value and only auto_applied (no pending/manual)", () => {
    expect(
      shouldShowContactIdentityRow(
        "birthDate",
        false,
        baseProvenance({ autoAppliedFields: ["birthDate"] }),
      ),
    ).toBe(false);
  });
});
