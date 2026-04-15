import { describe, expect, it } from "vitest";
import {
  parseContractWizardPrefillFromReviewData,
  shouldSuppressContractWizardPrefillAfterApply,
} from "../contact-wizard-prefill-from-ai-review";

describe("parseContractWizardPrefillFromReviewData", () => {
  it("maps create_contract draft action payload without setting partnerId/productId", () => {
    const out = parseContractWizardPrefillFromReviewData(null, [
      {
        type: "create_contract",
        payload: {
          segment: "ZP",
          institutionName: "Test Insurer",
          productName: "Životní pojistka",
          contractNumber: "123/2024",
          effectiveDate: "2024-01-15",
          premiumAmount: "1500",
        },
      },
    ]);
    expect(out.segment).toBe("ZP");
    expect(out.partnerName).toBe("Test Insurer");
    expect(out.productName).toBe("Životní pojistka");
    expect(out.contractNumber).toBe("123/2024");
    expect(out.startDate).toBeTruthy();
    expect(out.premiumAmount).toBe("1500");
    expect((out as { partnerId?: string }).partnerId).toBeUndefined();
    expect((out as { productId?: string }).productId).toBeUndefined();
  });

  it("fills from extractedFields when draft action is missing", () => {
    const out = parseContractWizardPrefillFromReviewData(
      {
        documentClassification: { primaryType: "nonlife_insurance_contract", subtype: "property" },
        extractedFields: {
          insurer: { value: "ACME" },
          productName: { value: "Majetek Plus" },
          contractNumber: { value: "X-1" },
        },
      },
      []
    );
    expect(out.partnerName).toBe("ACME");
    expect(out.productName).toBe("Majetek Plus");
    expect(out.contractNumber).toBe("X-1");
    expect(out.segment).toBe("MAJ");
  });
});

describe("shouldSuppressContractWizardPrefillAfterApply (canonical publish spine)", () => {
  it("suppresses when CRM contract row was created by apply", () => {
    expect(
      shouldSuppressContractWizardPrefillAfterApply({
        createdContractId: "550e8400-e29b-41d4-a716-446655440000",
        linkedClientId: "c1",
      }),
    ).toBe(true);
  });

  it("suppresses when publish outcome is supporting_doc_only", () => {
    expect(
      shouldSuppressContractWizardPrefillAfterApply({
        publishOutcome: { mode: "supporting_doc_only", paymentOutcome: "payment_setup_skipped", label: "x", visibleToClient: false },
      }),
    ).toBe(true);
  });

  it("suppresses when publish outcome is internal_document_only", () => {
    expect(
      shouldSuppressContractWizardPrefillAfterApply({
        publishOutcome: { mode: "internal_document_only", paymentOutcome: "payment_setup_skipped", label: "x", visibleToClient: false },
      }),
    ).toBe(true);
  });

  it("does not suppress when only client linked and no outcome yet (legacy shape)", () => {
    expect(
      shouldSuppressContractWizardPrefillAfterApply({
        linkedClientId: "c1",
      }),
    ).toBe(false);
  });

  it("suppresses after partial publish when contract row id is present (no second wizard)", () => {
    expect(
      shouldSuppressContractWizardPrefillAfterApply({
        createdContractId: "550e8400-e29b-41d4-a716-446655440000",
        publishOutcome: {
          mode: "publish_partial_failure",
          paymentOutcome: "payment_setup_skipped",
          label: "Parciální",
          visibleToClient: true,
        },
      }),
    ).toBe(true);
  });
});
