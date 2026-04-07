import { describe, it, expect } from "vitest";
import {
  resolveContractPendingFields,
  hasPendingContractFields,
} from "../[id]/contract-pending-fields-logic";
import type { ContractProvenanceInput } from "../[id]/contract-pending-fields-logic";

const baseProvenance = (
  overrides: Partial<NonNullable<ContractProvenanceInput>> = {},
): NonNullable<ContractProvenanceInput> => ({
  reviewId: "rev-001",
  pendingContractFields: [],
  manualRequiredContractFields: [],
  pendingPaymentFields: [],
  manualRequiredPaymentFields: [],
  supportingDocumentGuard: false,
  ...overrides,
});

describe("resolveContractPendingFields", () => {
  // -----------------------------------------------------------------------
  // A) Null provenance → prázdné
  // -----------------------------------------------------------------------
  it("returns empty array when provenance is null", () => {
    expect(resolveContractPendingFields(null)).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // B) Supporting document guard → žádné CTA
  // -----------------------------------------------------------------------
  it("C022/C040: returns empty array when supportingDocumentGuard=true", () => {
    const result = resolveContractPendingFields(
      baseProvenance({
        supportingDocumentGuard: true,
        pendingContractFields: ["contractNumber"],
        pendingPaymentFields: ["bankAccount"],
      }),
    );
    expect(result).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // C) Pending contract pole → pending_ai status
  // -----------------------------------------------------------------------
  it("returns pending_ai for pendingContractFields", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ pendingContractFields: ["contractNumber", "proposalNumber"] }),
    );
    const keys = result.map((r) => r.key);
    expect(keys).toContain("contractNumber");
    expect(keys).toContain("proposalNumber");
    expect(result.every((r) => r.status === "pending_ai")).toBe(true);
    expect(result.every((r) => r.scope === "contract")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // D) Pending payment pole → pending_ai status, scope=payment
  // -----------------------------------------------------------------------
  it("returns pending_ai with scope=payment for pendingPaymentFields", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ pendingPaymentFields: ["bankAccount", "variableSymbol"] }),
    );
    const paymentFields = result.filter((r) => r.scope === "payment");
    expect(paymentFields).toHaveLength(2);
    expect(paymentFields.every((r) => r.status === "pending_ai")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // E) Manual pole → manual status
  // -----------------------------------------------------------------------
  it("returns manual status for manualRequiredContractFields", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ manualRequiredContractFields: ["contractNumber"] }),
    );
    const f = result.find((r) => r.key === "contractNumber");
    expect(f?.status).toBe("manual");
  });

  // -----------------------------------------------------------------------
  // F) Pole v obou pending i manual → zobrazí se jen jako pending_ai (no dup)
  // -----------------------------------------------------------------------
  it("does not duplicate field that is in both pending and manual", () => {
    const result = resolveContractPendingFields(
      baseProvenance({
        pendingContractFields: ["contractNumber"],
        manualRequiredContractFields: ["contractNumber"],
      }),
    );
    const matches = result.filter((r) => r.key === "contractNumber");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.status).toBe("pending_ai");
  });

  // -----------------------------------------------------------------------
  // G) Smíšený případ — contract pending + payment pending
  // -----------------------------------------------------------------------
  it("returns both contract and payment pending fields", () => {
    const result = resolveContractPendingFields(
      baseProvenance({
        pendingContractFields: ["contractNumber"],
        pendingPaymentFields: ["bankAccount"],
      }),
    );
    expect(result.find((r) => r.key === "contractNumber")?.scope).toBe("contract");
    expect(result.find((r) => r.key === "bankAccount")?.scope).toBe("payment");
  });

  // -----------------------------------------------------------------------
  // H) Lidský label se vrací pro known fields
  // -----------------------------------------------------------------------
  it("returns human label for known field keys", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ pendingContractFields: ["contractNumber"] }),
    );
    expect(result[0]?.label).toBe("Číslo smlouvy");
  });

  it("returns key as label for unknown field keys", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ pendingContractFields: ["unknownFieldXYZ"] }),
    );
    expect(result[0]?.label).toBe("unknownFieldXYZ");
  });

  // -----------------------------------------------------------------------
  // I) Must-pass anchor C017 Roman Koloburda UNIQA
  //    contractNumber pending → pending_ai, scope=contract
  // -----------------------------------------------------------------------
  it("C017: contractNumber pending → pending_ai with scope=contract", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ pendingContractFields: ["contractNumber"] }),
    );
    const f = result.find((r) => r.key === "contractNumber");
    expect(f?.status).toBe("pending_ai");
    expect(f?.scope).toBe("contract");
  });

  // -----------------------------------------------------------------------
  // J) Must-pass anchor C025 ČSOB Leasing PBI
  //    lender/financing pending → pending_ai, scope=contract
  // -----------------------------------------------------------------------
  it("C025: loanAmount pending → pending_ai with scope=contract", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ pendingContractFields: ["loanAmount", "installmentAmount"] }),
    );
    expect(result.find((r) => r.key === "loanAmount")?.status).toBe("pending_ai");
    expect(result.find((r) => r.key === "installmentAmount")?.status).toBe("pending_ai");
  });

  // -----------------------------------------------------------------------
  // K) Must-pass anchor C030 IŽP Generali
  //    payment scope se neplete s contract scope
  // -----------------------------------------------------------------------
  it("C030: payment fields stay in payment scope, contract fields in contract scope", () => {
    const result = resolveContractPendingFields(
      baseProvenance({
        pendingContractFields: ["contractNumber"],
        pendingPaymentFields: ["bankAccount", "variableSymbol"],
      }),
    );
    const contract = result.filter((r) => r.scope === "contract");
    const payment = result.filter((r) => r.scope === "payment");
    expect(contract.map((r) => r.key)).toEqual(["contractNumber"]);
    expect(payment.map((r) => r.key).sort()).toEqual(["bankAccount", "variableSymbol"].sort());
  });

  // -----------------------------------------------------------------------
  // L) Must-pass anchor C029 Investiční smlouva Codya
  //    amountToPay pending → pending_ai
  // -----------------------------------------------------------------------
  it("C029: amountToPay pending → pending_ai with scope=contract", () => {
    const result = resolveContractPendingFields(
      baseProvenance({ pendingContractFields: ["amountToPay"] }),
    );
    expect(result.find((r) => r.key === "amountToPay")?.status).toBe("pending_ai");
  });
});

describe("hasPendingContractFields", () => {
  it("returns false for null provenance", () => {
    expect(hasPendingContractFields(null)).toBe(false);
  });

  it("returns false when supportingDocumentGuard=true", () => {
    expect(
      hasPendingContractFields(
        baseProvenance({
          supportingDocumentGuard: true,
          pendingContractFields: ["contractNumber"],
        }),
      ),
    ).toBe(false);
  });

  it("returns true when there are pending contract fields", () => {
    expect(
      hasPendingContractFields(baseProvenance({ pendingContractFields: ["contractNumber"] })),
    ).toBe(true);
  });

  it("returns true when there are pending payment fields", () => {
    expect(
      hasPendingContractFields(baseProvenance({ pendingPaymentFields: ["bankAccount"] })),
    ).toBe(true);
  });

  it("returns false when all arrays are empty", () => {
    expect(hasPendingContractFields(baseProvenance())).toBe(false);
  });
});
