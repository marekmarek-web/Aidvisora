import { describe, expect, it } from "vitest";
import type { DocumentReviewEnvelope } from "../document-review-types";
import { resolveDocumentSchema } from "../document-schema-router";
import { runVerificationPass } from "../document-verification";
import { resolveSensitivityProfile } from "../document-sensitivity";

type FixtureScenario = {
  name: string;
  envelope: DocumentReviewEnvelope;
  expectedType: string;
  expectedLifecycle: string;
  requiredFieldsMustBeSatisfied: string[];
  optionalFields: string[];
  notApplicableFields: string[];
  expectedActionTypes: string[];
};

function baseEnvelope(primaryType: DocumentReviewEnvelope["documentClassification"]["primaryType"]): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType,
      subtype: "fixture",
      lifecycleStatus: "unknown",
      confidence: 0.86,
      reasons: ["fixture"],
    },
    documentMeta: {
      scannedVsDigital: "digital",
      overallConfidence: 0.86,
    },
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
      score: 0,
      reason: "no_match",
      ambiguityFlags: [],
    },
    reviewWarnings: [],
    suggestedActions: [],
    sensitivityProfile: "standard_personal_data",
  };
}

const SCENARIOS: FixtureScenario[] = [
  {
    name: "Generali rizikova zivotni pojistka",
    envelope: {
      ...baseEnvelope("life_insurance_contract"),
      documentClassification: {
        primaryType: "life_insurance_contract",
        subtype: "generali_bel_mondo",
        lifecycleStatus: "final_contract",
        confidence: 0.91,
        reasons: ["Generali", "pojistná smlouva"],
      },
      extractedFields: {
        insurer: { value: "Generali", confidence: 0.95, sourcePage: 1, evidenceSnippet: "Generali", status: "extracted" },
        productName: { value: "Bel Mondo", confidence: 0.92, sourcePage: 1, evidenceSnippet: "BEL MONDO", status: "extracted" },
        documentStatus: { value: "final_contract", confidence: 0.9, sourcePage: 1, evidenceSnippet: "Smlouva", status: "extracted" },
        policyStartDate: { value: "2026-01-01", confidence: 0.86, sourcePage: 2, evidenceSnippet: "Počátek pojištění", status: "extracted" },
      },
    },
    expectedType: "life_insurance_contract",
    expectedLifecycle: "final_contract",
    requiredFieldsMustBeSatisfied: ["extractedFields.insurer", "extractedFields.productName"],
    optionalFields: ["extractedFields.coverages"],
    notApplicableFields: ["extractedFields.collateral"],
    expectedActionTypes: ["create_or_link_client", "create_contract_record"],
  },
  {
    name: "UNIQA navrh s vice pojistenymi osobami",
    envelope: {
      ...baseEnvelope("life_insurance_proposal"),
      documentClassification: {
        primaryType: "life_insurance_proposal",
        subtype: "uniqa_domino_risk",
        lifecycleStatus: "proposal",
        confidence: 0.88,
        reasons: ["Návrh pojistné smlouvy"],
      },
      extractedFields: {
        insurer: { value: "UNIQA", confidence: 0.9, sourcePage: 1, evidenceSnippet: "UNIQA", status: "extracted" },
        productName: { value: "Domino Risk", confidence: 0.84, sourcePage: 1, evidenceSnippet: "Domino", status: "extracted" },
        documentStatus: { value: "proposal", confidence: 0.9, sourcePage: 1, evidenceSnippet: "Návrh", status: "extracted" },
        proposalNumber_or_contractNumber: { value: "NVRH-123", confidence: 0.8, sourcePage: 1, evidenceSnippet: "číslo návrhu", status: "extracted" },
        insuredPersons: { value: [{ role: "policyholder" }, { role: "child" }], confidence: 0.7, sourcePage: 3, evidenceSnippet: "pojištěné osoby", status: "extracted" },
      },
    },
    expectedType: "life_insurance_proposal",
    expectedLifecycle: "proposal",
    requiredFieldsMustBeSatisfied: ["extractedFields.insurer", "extractedFields.proposalNumber_or_contractNumber"],
    optionalFields: ["extractedFields.riders"],
    notApplicableFields: ["extractedFields.contractSignedDate"],
    expectedActionTypes: ["create_opportunity", "create_task_followup"],
  },
  {
    name: "MAXIMA nabidka RZP",
    envelope: {
      ...baseEnvelope("liability_insurance_offer"),
      documentClassification: {
        primaryType: "liability_insurance_offer",
        subtype: "maxima_maxefekt",
        lifecycleStatus: "offer",
        confidence: 0.81,
        reasons: ["Nabídka"],
      },
      extractedFields: {
        offerType: { value: "offer", confidence: 0.9, sourcePage: 1, evidenceSnippet: "Nabídka", status: "extracted" },
        productArea: { value: "liability_insurance", confidence: 0.82, sourcePage: 1, evidenceSnippet: "odpovědnosti", status: "extracted" },
      },
    },
    expectedType: "liability_insurance_offer",
    expectedLifecycle: "offer",
    requiredFieldsMustBeSatisfied: ["extractedFields.offerType", "extractedFields.productArea"],
    optionalFields: ["extractedFields.coverageLimit"],
    notApplicableFields: ["extractedFields.bindingContract"],
    expectedActionTypes: ["create_opportunity", "create_task_followup"],
  },
  {
    name: "MONETA uver s pojistenim schopnosti splacet",
    envelope: {
      ...baseEnvelope("consumer_loan_with_payment_protection"),
      documentClassification: {
        primaryType: "consumer_loan_with_payment_protection",
        subtype: "moneta_expres_pujcka",
        lifecycleStatus: "final_contract",
        confidence: 0.89,
        reasons: ["úvěr + pojištění"],
      },
      extractedFields: {
        lender: { value: "MONETA", confidence: 0.9, sourcePage: 1, evidenceSnippet: "MONETA", status: "extracted" },
        contractNumber: { value: "U-123", confidence: 0.88, sourcePage: 1, evidenceSnippet: "číslo smlouvy", status: "extracted" },
        loanAmount: { value: 350000, confidence: 0.87, sourcePage: 2, evidenceSnippet: "Výše úvěru", status: "extracted" },
        paymentProtectionProvider: { value: "MONETA PPI", confidence: 0.79, sourcePage: 3, evidenceSnippet: "pojištění schopnosti splácet", status: "extracted" },
        insuredRisks: { value: ["pracovní neschopnost"], confidence: 0.7, sourcePage: 3, evidenceSnippet: "pojistná rizika", status: "extracted" },
      },
    },
    expectedType: "consumer_loan_with_payment_protection",
    expectedLifecycle: "final_contract",
    requiredFieldsMustBeSatisfied: ["extractedFields.lender", "extractedFields.paymentProtectionProvider"],
    optionalFields: ["extractedFields.monthlyInsuranceCharge"],
    notApplicableFields: ["extractedFields.collateral"],
    expectedActionTypes: ["create_or_link_client", "create_contract_record"],
  },
  {
    name: "Potvrzeni o prijmu",
    envelope: {
      ...baseEnvelope("income_confirmation"),
      documentClassification: {
        primaryType: "income_confirmation",
        subtype: "csob_income_confirmation",
        lifecycleStatus: "confirmation",
        confidence: 0.84,
        reasons: ["Potvrzení o příjmu"],
      },
      extractedFields: {
        employerName: { value: "ACME s.r.o.", confidence: 0.88, sourcePage: 1, evidenceSnippet: "zaměstnavatel", status: "extracted" },
        employeeFullName: { value: "Jan Novak", confidence: 0.87, sourcePage: 1, evidenceSnippet: "zaměstnanec", status: "extracted" },
        issueDate: { value: "2026-02-01", confidence: 0.9, sourcePage: 1, evidenceSnippet: "datum vystavení", status: "extracted" },
      },
    },
    expectedType: "income_confirmation",
    expectedLifecycle: "confirmation",
    requiredFieldsMustBeSatisfied: ["extractedFields.employerName", "extractedFields.employeeFullName"],
    optionalFields: ["extractedFields.averageNetIncomeLast3Months"],
    notApplicableFields: ["extractedFields.contractNumber"],
    expectedActionTypes: ["create_income_verification_record", "propose_financial_analysis_update"],
  },
  {
    name: "Bankovni vypis",
    envelope: {
      ...baseEnvelope("bank_statement"),
      documentClassification: {
        primaryType: "bank_statement",
        subtype: "csob_bank_statement",
        lifecycleStatus: "statement",
        confidence: 0.82,
        reasons: ["Výpis z účtu"],
      },
      extractedFields: {
        bankName: { value: "ČSOB", confidence: 0.91, sourcePage: 1, evidenceSnippet: "ČSOB", status: "extracted" },
        accountOwner: { value: "Jan Novak", confidence: 0.86, sourcePage: 1, evidenceSnippet: "Majitel účtu", status: "extracted" },
        statementPeriodFrom: { value: "2026-01-01", confidence: 0.85, sourcePage: 1, evidenceSnippet: "Období od", status: "extracted" },
        statementPeriodTo: { value: "2026-01-31", confidence: 0.85, sourcePage: 1, evidenceSnippet: "do", status: "extracted" },
        ibanMasked: { value: "CZ12**********3456", confidence: 0.8, sourcePage: 1, evidenceSnippet: "IBAN", status: "extracted", sensitive: true },
      },
    },
    expectedType: "bank_statement",
    expectedLifecycle: "statement",
    requiredFieldsMustBeSatisfied: ["extractedFields.bankName", "extractedFields.statementPeriodFrom"],
    optionalFields: ["extractedFields.transactionsSummary"],
    notApplicableFields: ["extractedFields.policyStartDate"],
    expectedActionTypes: ["request_manual_review", "propose_financial_analysis_update"],
  },
  {
    name: "Investicni servisni smlouva",
    envelope: {
      ...baseEnvelope("investment_service_agreement"),
      documentClassification: {
        primaryType: "investment_service_agreement",
        subtype: "codya_invest_service_agreement",
        lifecycleStatus: "onboarding_form",
        confidence: 0.83,
        reasons: ["servisní smlouva"],
      },
      extractedFields: {
        companyName: { value: "Codya Invest", confidence: 0.86, sourcePage: 1, evidenceSnippet: "Codya", status: "extracted" },
        serviceType: { value: "investment_onboarding", confidence: 0.8, sourcePage: 1, evidenceSnippet: "služby", status: "extracted" },
        investorFullName: { value: "Jiri Chlumecky", confidence: 0.87, sourcePage: 1, evidenceSnippet: "investor", status: "extracted" },
      },
    },
    expectedType: "investment_service_agreement",
    expectedLifecycle: "onboarding_form",
    requiredFieldsMustBeSatisfied: ["extractedFields.companyName", "extractedFields.investorFullName"],
    optionalFields: ["extractedFields.fatcaStatus"],
    notApplicableFields: ["extractedFields.loanAmount"],
    expectedActionTypes: ["create_opportunity", "create_task_onboarding"],
  },
  {
    name: "Nabidka odpovednostniho pojisteni",
    envelope: {
      ...baseEnvelope("insurance_comparison"),
      documentClassification: {
        primaryType: "insurance_comparison",
        subtype: "employer_liability_offer",
        lifecycleStatus: "comparison",
        confidence: 0.79,
        reasons: ["srovnání nabídek"],
      },
      extractedFields: {
        offerType: { value: "comparison", confidence: 0.85, sourcePage: 1, evidenceSnippet: "srovnání", status: "extracted" },
        productArea: { value: "liability", confidence: 0.84, sourcePage: 1, evidenceSnippet: "odpovědnost", status: "extracted" },
      },
    },
    expectedType: "insurance_comparison",
    expectedLifecycle: "comparison",
    requiredFieldsMustBeSatisfied: ["extractedFields.offerType", "extractedFields.productArea"],
    optionalFields: ["extractedFields.packageName"],
    notApplicableFields: ["extractedFields.bindingContract"],
    expectedActionTypes: ["create_opportunity", "create_task_followup"],
  },
];

describe("document-pipeline-fixtures", () => {
  for (const scenario of SCENARIOS) {
    it(`validates scenario: ${scenario.name}`, () => {
      expect(scenario.envelope.documentClassification.primaryType).toBe(scenario.expectedType);
      expect(scenario.envelope.documentClassification.lifecycleStatus).toBe(scenario.expectedLifecycle);

      const schema = resolveDocumentSchema(scenario.envelope.documentClassification.primaryType);
      const verification = runVerificationPass(scenario.envelope, schema);
      for (const requiredField of scenario.requiredFieldsMustBeSatisfied) {
        const key = requiredField.replace(/^extractedFields\./, "");
        const field = verification.envelope.extractedFields[key];
        expect(field).toBeDefined();
        expect(["extracted", "inferred_low_confidence", "explicitly_not_selected", "not_applicable"]).toContain(field?.status);
      }

      for (const actionType of scenario.expectedActionTypes) {
        expect(schema.extractionRules.suggestedActionRules.join("|")).toContain(actionType);
      }

      const sensitivity = resolveSensitivityProfile(verification.envelope);
      expect(sensitivity).toBeDefined();
      expect(verification.envelope.dataCompleteness?.requiredTotal ?? 0).toBeGreaterThanOrEqual(0);
    });
  }
});

