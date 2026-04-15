import { describe, it, expect } from "vitest";
import { validateBeforeApply, isBindingLifecycle, isSupportingLifecycle } from "../pre-apply-validation";
import type { DocumentReviewEnvelope } from "../document-review-types";

function makeEnvelope(
  overrides: {
    lifecycle?: string;
    ef?: Record<string, { value?: unknown; status?: string }>;
  } = {}
): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType: "life_insurance_contract",
      lifecycleStatus: (overrides.lifecycle ?? "final_contract") as never,
      documentIntent: "creates_new_product",
      confidence: 0.9,
      reasons: [],
    },
    extractedFields: (overrides.ef ?? {}) as never,
  } as DocumentReviewEnvelope;
}

describe("validateBeforeApply", () => {
  it("passes a fully valid final_contract envelope", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "123456789", status: "extracted" },
        policyholderName: { value: "Jan Novák", status: "extracted" },
        insurer: { value: "Česká pojišťovna", status: "extracted" },
        premiumAmount: { value: "1200", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("errors when contractNumber is missing for final_contract", () => {
    const env = makeEnvelope({
      ef: {
        policyholderName: { value: "Jan Novák", status: "extracted" },
        insurer: { value: "Pojišťovna XY", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "contract_number_required")).toBe(true);
  });

  it("errors when policyholderName is missing", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "ABC123", status: "extracted" },
        insurer: { value: "Pojišťovna XY", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "policyholder_name_required")).toBe(true);
  });

  it("accepts borrowerName as domain equivalent of policyholderName", () => {
    const env = makeEnvelope({
      lifecycle: "final_contract",
      ef: {
        contractNumber: { value: "LOAN-001", status: "extracted" },
        borrowerName: { value: "Jana Procházková", status: "extracted" },
        lender: { value: "Komerční banka", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "UVER");
    const holderIssue = result.issues.find((i) => i.rule === "policyholder_name_required");
    expect(holderIssue).toBeUndefined();
  });

  it("errors when segment is invalid", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "X", status: "extracted" },
        policyholderName: { value: "Novák", status: "extracted" },
        insurer: { value: "Pojišťovna", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "NEEXISTUJE");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "segment_invalid")).toBe(true);
  });

  it("errors when premiumAmount is negative", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "X", status: "extracted" },
        policyholderName: { value: "Novák", status: "extracted" },
        insurer: { value: "Pojišťovna", status: "extracted" },
        premiumAmount: { value: "-500", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "premium_amount_positive")).toBe(true);
  });

  it("allows premiumAmount with Czech formatting (space thousands)", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "X", status: "extracted" },
        policyholderName: { value: "Novák", status: "extracted" },
        insurer: { value: "Pojišťovna", status: "extracted" },
        premiumAmount: { value: "1 200,50", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    const premiumIssue = result.issues.find((i) => i.rule === "premium_amount_positive");
    expect(premiumIssue).toBeUndefined();
  });

  it("warns when DPS segment has no participantContribution", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "DPS-001", status: "extracted" },
        participantFullName: { value: "Jana Nováková", status: "extracted" },
        pensionFundName: { value: "Penzijní fond ČS", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "DPS");
    const issue = result.issues.find((i) => i.rule === "dps_participant_contribution_required");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warning");
    // Should still be valid (warnings don't block)
    expect(result.valid).toBe(true);
  });

  it("does not require contractNumber for supporting lifecycle", () => {
    const env = makeEnvelope({
      lifecycle: "statement",
      ef: {
        policyholderName: { value: "Novák", status: "extracted" },
        insurer: { value: "Pojišťovna", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    const issue = result.issues.find((i) => i.rule === "contract_number_required");
    expect(issue).toBeUndefined();
  });

  it("skips most rules for payroll_statement lifecycle", () => {
    const env = makeEnvelope({
      lifecycle: "payroll_statement",
      ef: {},
    });
    const result = validateBeforeApply(env, "ZP");
    // segment might still flag; but no policyholder/contract rules
    const blocking = result.issues.filter(
      (i) => i.severity === "error" && i.rule !== "segment_invalid"
    );
    expect(blocking).toHaveLength(0);
  });
});

describe("validateBeforeApply — alias-expanded fields", () => {
  it("accepts policyNumber as contractNumber alias", () => {
    const env = makeEnvelope({
      ef: {
        policyNumber: { value: "POL-999", status: "extracted" },
        policyholderName: { value: "Jan Novák", status: "extracted" },
        partnerName: { value: "Allianz", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.issues.find((i) => i.rule === "contract_number_required")).toBeUndefined();
  });

  it("accepts customerName as policyholder alias", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "C-123", status: "extracted" },
        customerName: { value: "Eva Malá", status: "extracted" },
        insurer: { value: "ČSOB", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.issues.find((i) => i.rule === "policyholder_name_required")).toBeUndefined();
  });

  it("accepts companyName as institution alias", () => {
    const env = makeEnvelope({
      ef: {
        contractNumber: { value: "C-456", status: "extracted" },
        policyholderName: { value: "Petr Novotný", status: "extracted" },
        companyName: { value: "NN Životní pojišťovna", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.issues.find((i) => i.rule === "institution_name_required")).toBeUndefined();
  });

  it("rejects missing value even with alias key present", () => {
    const env = makeEnvelope({
      ef: {
        policyNumber: { value: "", status: "missing" },
        policyholderName: { value: "Jan", status: "extracted" },
        insurer: { value: "XYZ", status: "extracted" },
      },
    });
    const result = validateBeforeApply(env, "ZP");
    expect(result.issues.find((i) => i.rule === "contract_number_required")).toBeDefined();
  });
});

describe("lifecycle helpers", () => {
  it("isBindingLifecycle returns true for final_contract", () => {
    expect(isBindingLifecycle("final_contract")).toBe(true);
  });

  it("isBindingLifecycle returns false for statement", () => {
    expect(isBindingLifecycle("statement")).toBe(false);
  });

  it("isSupportingLifecycle returns true for unknown", () => {
    expect(isSupportingLifecycle("unknown")).toBe(true);
  });

  it("isSupportingLifecycle returns false for proposal", () => {
    expect(isSupportingLifecycle("proposal")).toBe(false);
  });
});
