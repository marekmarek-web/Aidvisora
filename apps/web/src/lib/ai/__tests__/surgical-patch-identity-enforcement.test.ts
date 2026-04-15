import { describe, it, expect } from "vitest";
import { buildContactMergePayloadFromExtractedEnvelope } from "../draft-actions";
import { enforceField } from "../apply-policy-enforcement";
import type { DocumentReviewEnvelope } from "../document-review-types";

function makeEnvelopeWithIdentity(
  identity: Record<string, { value?: unknown; status?: string }>
): Record<string, unknown> {
  return {
    documentClassification: {
      primaryType: "life_insurance_contract",
      lifecycleStatus: "final_contract",
      documentIntent: "creates_new_product",
      confidence: 0.9,
      reasons: [],
    },
    extractedFields: {
      policyholderName: { value: "Jan Novák", status: "extracted" },
      contractNumber: { value: "POL-123", status: "extracted" },
      insurer: { value: "Allianz", status: "extracted" },
      ...identity,
    },
    parties: {},
  } as unknown as Record<string, unknown>;
}

describe("buildContactMergePayloadFromExtractedEnvelope — identity fields", () => {
  it("includes idCardNumber when extracted", () => {
    const payload = buildContactMergePayloadFromExtractedEnvelope(
      makeEnvelopeWithIdentity({
        idCardNumber: { value: "123456789", status: "extracted" },
        idCardIssuedBy: { value: "MÚ Praha", status: "extracted" },
        idCardValidUntil: { value: "2030-01-01", status: "extracted" },
        idCardIssuedAt: { value: "2020-06-15", status: "extracted" },
        generalPractitioner: { value: "MUDr. Novotný", status: "extracted" },
      })
    );
    expect(payload.idCardNumber).toBe("123456789");
    expect(payload.idCardIssuedBy).toBe("MÚ Praha");
    expect(payload.idCardValidUntil).toBe("2030-01-01");
    expect(payload.idCardIssuedAt).toBe("2020-06-15");
    expect(payload.generalPractitioner).toBe("MUDr. Novotný");
  });

  it("falls back to documentNumber alias for idCardNumber", () => {
    const payload = buildContactMergePayloadFromExtractedEnvelope(
      makeEnvelopeWithIdentity({
        documentNumber: { value: "DOC-555", status: "extracted" },
      })
    );
    expect(payload.idCardNumber).toBe("DOC-555");
  });

  it("returns empty strings when identity fields are absent", () => {
    const payload = buildContactMergePayloadFromExtractedEnvelope(
      makeEnvelopeWithIdentity({})
    );
    expect(payload.idCardNumber).toBe("");
    expect(payload.idCardIssuedBy).toBe("");
    expect(payload.generalPractitioner).toBe("");
  });

  it("returns empty object for non-envelope input", () => {
    const payload = buildContactMergePayloadFromExtractedEnvelope({});
    expect(payload).toEqual({});
  });
});

describe("enforceField — inferred_low_confidence status", () => {
  it("treats inferred_low_confidence as Odvozeno (not Chybí)", () => {
    const decision = enforceField(
      "contractNumber",
      { value: "REF-001", status: "inferred_low_confidence", confidence: 0.6 },
      "life_insurance_final_contract",
      false,
    );
    expect(decision.policy).not.toBe("manual_required");
    expect(decision.include).toBe(true);
  });

  it("still marks truly missing fields as manual_required", () => {
    const decision = enforceField(
      "contractNumber",
      { value: null, status: "missing" },
      "life_insurance_final_contract",
      false,
    );
    expect(decision.policy).toBe("manual_required");
    expect(decision.leaveEmpty).toBe(true);
  });
});
