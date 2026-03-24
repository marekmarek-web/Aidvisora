import { describe, it, expect } from "vitest";
import {
  mapPrimaryToPipelineClassification,
  resolveExtractionRoute,
  isProposalOrModelationLifecycle,
} from "../pipeline-extraction-routing";

describe("pipeline-extraction-routing", () => {
  it("maps payment primary types to payment_instructions", () => {
    expect(mapPrimaryToPipelineClassification("payment_instruction")).toBe("payment_instructions");
    expect(mapPrimaryToPipelineClassification("investment_payment_instruction")).toBe("payment_instructions");
  });

  it("routes payment to dedicated extraction branch", () => {
    expect(resolveExtractionRoute("payment_instructions", 0.9)).toBe("payment_instructions");
  });

  it("routes bank and income to supporting_document", () => {
    expect(resolveExtractionRoute("bank_statement", 0.8)).toBe("supporting_document");
    expect(resolveExtractionRoute("income_document", 0.8)).toBe("supporting_document");
  });

  it("routes unknown with very low confidence to manual_review_only", () => {
    expect(resolveExtractionRoute("unknown", 0.2)).toBe("manual_review_only");
  });

  it("routes unknown with moderate confidence to manual_review_only", () => {
    expect(resolveExtractionRoute("unknown", 0.5)).toBe("manual_review_only");
  });

  it("routes insurance contract to contract_intake", () => {
    expect(resolveExtractionRoute("insurance_contract", 0.9)).toBe("contract_intake");
  });

  it("detects proposal/modelation lifecycle", () => {
    expect(isProposalOrModelationLifecycle("proposal")).toBe(true);
    expect(isProposalOrModelationLifecycle("modelation")).toBe(true);
    expect(isProposalOrModelationLifecycle("final_contract")).toBe(false);
  });
});
