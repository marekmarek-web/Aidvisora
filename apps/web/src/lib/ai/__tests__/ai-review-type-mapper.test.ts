import { describe, expect, it } from "vitest";
import { mapAiClassifierToPrimaryType, primaryTypeFallbackFromPromptKey } from "../ai-review-type-mapper";

function cls(partial: Record<string, unknown>) {
  return {
    documentType: "proposal",
    productFamily: "life_insurance",
    productSubtype: "risk_life_insurance",
    businessIntent: "standard",
    recommendedRoute: "extract",
    confidence: 0.9,
    reasons: [],
    warnings: [],
    ...partial,
  } as Parameters<typeof mapAiClassifierToPrimaryType>[0];
}

describe("mapAiClassifierToPrimaryType", () => {
  it("maps life insurance proposal to life_insurance_proposal", () => {
    expect(mapAiClassifierToPrimaryType(cls({ documentType: "proposal" }))).toBe("life_insurance_proposal");
  });

  it("maps life insurance offer to life_insurance_proposal", () => {
    expect(mapAiClassifierToPrimaryType(cls({ documentType: "offer" }))).toBe("life_insurance_proposal");
  });

  it("maps life insurance modelation to life_insurance_modelation", () => {
    expect(mapAiClassifierToPrimaryType(cls({ documentType: "modelation" }))).toBe("life_insurance_modelation");
  });

  it("maps life investment contract subtype", () => {
    expect(
      mapAiClassifierToPrimaryType(
        cls({ documentType: "contract", productSubtype: "investment_life_insurance" })
      )
    ).toBe("life_insurance_investment_contract");
  });

  it("maps non-life proposal with liability subtype", () => {
    expect(
      mapAiClassifierToPrimaryType(
        cls({
          documentType: "proposal",
          productFamily: "non_life_insurance",
          productSubtype: "liability_insurance",
        })
      )
    ).toBe("liability_insurance_offer");
  });

  it("maps payment_instructions + investment family to investment_payment_instruction (e.g. FUNDOO/Amundi)", () => {
    expect(
      mapAiClassifierToPrimaryType(
        cls({
          documentType: "payment_instructions",
          productFamily: "investment",
          productSubtype: "unknown",
        })
      )
    ).toBe("investment_payment_instruction");
  });

  it("maps payment_instructions + fundoo subtype to investment_payment_instruction", () => {
    expect(
      mapAiClassifierToPrimaryType(
        cls({
          documentType: "payment_instructions",
          productFamily: "banking",
          productSubtype: "fundoo",
        })
      )
    ).toBe("investment_payment_instruction");
  });

  it("maps generic payment_instructions to payment_instruction", () => {
    expect(
      mapAiClassifierToPrimaryType(
        cls({
          documentType: "payment_instructions",
          productFamily: "life_insurance",
          productSubtype: "risk_life_insurance",
        })
      )
    ).toBe("payment_instruction");
  });
});

describe("primaryTypeFallbackFromPromptKey", () => {
  it("falls back insurance proposal modelation for life family", () => {
    expect(
      primaryTypeFallbackFromPromptKey("insuranceProposalModelation", {
        documentType: "proposal",
        productFamily: "life_insurance",
        productSubtype: "risk_life_insurance",
        businessIntent: "x",
        recommendedRoute: "x",
        confidence: 0.8,
        reasons: [],
        warnings: [],
      } as Parameters<typeof primaryTypeFallbackFromPromptKey>[1])
    ).toBe("life_insurance_proposal");
  });
});
