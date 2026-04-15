import { describe, expect, it } from "vitest";
import type { DocumentReviewEnvelope } from "../document-review-types";
import { buildCanonicalPaymentPayload, fvAccountNumberForPaymentSync, isPaymentSyncReady } from "../payment-field-contract";
import { applySemanticContractUnderstanding, suppressCrossSegmentLoanFields } from "../contract-semantic-understanding";
import { buildAllDraftActions } from "../draft-actions";

function baseEnvelope(
  primary: DocumentReviewEnvelope["documentClassification"]["primaryType"],
  lifecycle: DocumentReviewEnvelope["documentClassification"]["lifecycleStatus"],
): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType: primary,
      subtype: "test",
      lifecycleStatus: lifecycle,
      documentIntent: "creates_new_product",
      confidence: 0.9,
      reasons: [],
    },
    documentMeta: { scannedVsDigital: "digital", overallConfidence: 0.9 },
    parties: {},
    productsOrObligations: [],
    financialTerms: {},
    serviceTerms: {},
    extractedFields: {},
    evidence: [],
    candidateMatches: {
      matchedClients: [],
      matchedHouseholds: [],
      matchedDeals: [],
      matchedCompanies: [],
      matchedContracts: [],
      score: 0,
      reason: "no_match",
      ambiguityFlags: [],
    },
    sectionSensitivity: {},
    relationshipInference: {
      policyholderVsInsured: [],
      childInsured: [],
      intermediaryVsClient: [],
      employerVsEmployee: [],
      companyVsPerson: [],
      bankOrLenderVsBorrower: [],
    },
    reviewWarnings: [],
    suggestedActions: [],
    sensitivityProfile: "standard_personal_data",
    contentFlags: {
      isFinalContract: true,
      isProposalOnly: false,
      containsPaymentInstructions: false,
      containsClientData: true,
      containsAdvisorData: false,
      containsMultipleDocumentSections: false,
    },
  };
}

describe("segment semantics + finality (generic)", () => {
  it("životní pojištění negeneruje úvěrová pole v extrakci po sémantice", () => {
    const env = baseEnvelope("life_insurance_contract", "final_contract");
    env.extractedFields = {
      contractNumber: { value: "ZP-1", status: "extracted", confidence: 0.9 },
      insurer: { value: "ACME", status: "extracted", confidence: 0.9 },
      policyStartDate: { value: "2026-01-01", status: "extracted", confidence: 0.9 },
      loanAmount: { value: "500000", status: "extracted", confidence: 0.4 },
      installmentAmount: { value: "2000", status: "extracted", confidence: 0.4 },
    };
    applySemanticContractUnderstanding(env);
    expect(env.extractedFields.loanAmount?.status).toBe("not_applicable");
    expect(env.extractedFields.installmentAmount?.status).toBe("not_applicable");
  });

  it("investiční smlouva negeneruje úvěrová pole v extrakci po sémantice", () => {
    const env = baseEnvelope("investment_subscription_document", "final_contract");
    env.extractedFields = {
      investorFullName: { value: "Jan Test", status: "extracted", confidence: 0.9 },
      contractNumber: { value: "INV-9", status: "extracted", confidence: 0.9 },
      provider: { value: "Správce", status: "extracted", confidence: 0.9 },
      policyStartDate: { value: "2026-02-01", status: "extracted", confidence: 0.9 },
      loanAmount: { value: "100000", status: "extracted", confidence: 0.3 },
      lender: { value: "Fake Bank", status: "extracted", confidence: 0.3 },
    };
    applySemanticContractUnderstanding(env);
    expect(env.extractedFields.loanAmount?.status).toBe("not_applicable");
    expect(env.extractedFields.lender?.status).toBe("not_applicable");
  });

  it("klientský bankAccount (investor_block) se nepoužije jako příjemní účet pro sync — preferuje recipientAccount", () => {
    const ef = {
      recipientAccount: {
        value: "123456789/0800",
        status: "extracted" as const,
        confidence: 0.9,
        sourceKind: "payment_block" as const,
      },
      bankAccount: {
        value: "999/0100",
        status: "extracted" as const,
        confidence: 0.85,
        sourceKind: "investor_block" as const,
      },
    };
    expect(fvAccountNumberForPaymentSync(ef, "investment_subscription_document")).toBe("123456789/0800");
    const env: DocumentReviewEnvelope = {
      ...baseEnvelope("investment_subscription_document", "final_contract"),
      extractedFields: ef,
    };
    const cp = buildCanonicalPaymentPayload(env);
    expect(cp.accountNumber).toBe("123456789/0800");
  });

  it("platebně bohatá finální smlouva: obnoví publishHints po payment-only blokaci (investice)", () => {
    const env = baseEnvelope("investment_subscription_document", "final_contract");
    env.extractedFields = {
      investorFullName: { value: "Eva Test", status: "extracted", confidence: 0.9 },
      contractNumber: { value: "INV-77", status: "extracted", confidence: 0.9 },
      provider: { value: "Platforma", status: "extracted", confidence: 0.9 },
      policyStartDate: { value: "2026-03-01", status: "extracted", confidence: 0.9 },
    };
    env.publishHints = {
      contractPublishable: false,
      reviewOnly: true,
      needsSplit: false,
      needsManualValidation: false,
      sensitiveAttachmentOnly: true,
      reasons: ["payment_instruction_only_no_contract"],
    };
    applySemanticContractUnderstanding(env);
    expect(env.publishHints?.contractPublishable).toBe(true);
    expect(env.publishHints?.reasons?.some((r) => r === "investment_final_contract_recovered")).toBe(true);
  });

  it("informativní platební blok bez sync-ready údajů nevytvoří automatický návrh platebního nastavení", () => {
    const env = baseEnvelope("life_insurance_contract", "final_contract");
    env.contentFlags = {
      ...env.contentFlags!,
      containsPaymentInstructions: true,
    };
    env.extractedFields = {
      insurer: { value: "ACME", status: "extracted", confidence: 0.9 },
      productName: { value: "Život", status: "extracted", confidence: 0.9 },
      contractNumber: { value: "L-1", status: "extracted", confidence: 0.9 },
      policyStartDate: { value: "2026-01-01", status: "extracted", confidence: 0.9 },
      totalMonthlyPremium: { value: "1500 Kč", status: "extracted", confidence: 0.88 },
    };
    applySemanticContractUnderstanding(env);
    expect(env.contentFlags?.paymentInformationalOnly).toBe(true);
    expect(isPaymentSyncReady(buildCanonicalPaymentPayload(env))).toBe(false);
    const actions = buildAllDraftActions(env);
    const paymentSetups = actions.filter((a) => a.type === "create_payment_setup");
    expect(paymentSetups.length).toBe(0);
  });

  it("úvěrový dokument nesmí potlačit loanAmount", () => {
    const ef: Record<string, import("../document-review-types").ExtractedField | undefined> = {
      loanAmount: { value: "100000", status: "extracted", confidence: 0.9 },
    };
    suppressCrossSegmentLoanFields("consumer_loan_contract", ef);
    expect(ef.loanAmount?.status).toBe("extracted");
  });
});
