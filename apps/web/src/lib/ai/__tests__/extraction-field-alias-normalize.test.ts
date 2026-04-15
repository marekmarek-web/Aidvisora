import { describe, expect, it } from "vitest";
import type { DocumentReviewEnvelope } from "../document-review-types";
import { applyExtractedFieldAliasNormalizations } from "../extraction-field-alias-normalize";
import { selectSchemaForType } from "../document-schema-router";
import { runVerificationPass } from "../document-verification";

function minimalEnvelope(primaryType: DocumentReviewEnvelope["documentClassification"]["primaryType"]): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType,
      subtype: "test",
      lifecycleStatus: "final_contract",
      documentIntent: "creates_new_product",
      confidence: 0.9,
      reasons: [],
    },
    documentMeta: {
      scannedVsDigital: "digital",
      overallConfidence: 0.9,
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
      containsClientData: false,
      containsAdvisorData: false,
      containsMultipleDocumentSections: false,
    },
  };
}

describe("applyExtractedFieldAliasNormalizations", () => {
  it("fills canonical life_insurance_investment_contract fields from LLM aliases", () => {
    const env = minimalEnvelope("life_insurance_investment_contract");
    env.extractedFields = {
      institutionName: {
        value: "Generali Česká pojišťovna a.s.",
        status: "extracted",
        confidence: 0.88,
        evidenceSnippet: "pojistitel",
      },
      productName: {
        value: "Bel Mondo 20",
        status: "extracted",
        confidence: 0.9,
        evidenceSnippet: "produkt",
      },
      policyNumber: {
        value: "3282880076",
        status: "extracted",
        confidence: 0.85,
        evidenceSnippet: "smlouva",
      },
      effectiveDate: {
        value: "1. 6. 2026",
        status: "extracted",
        confidence: 0.84,
        evidenceSnippet: "počátek",
      },
      investmentDetails: {
        value: { strategy: "Fond fondů dynamický 100 %" },
        status: "extracted",
        confidence: 0.8,
        evidenceSnippet: "strategie",
      },
      monthlyPremium: {
        value: "4 166 Kč",
        status: "extracted",
        confidence: 0.82,
        evidenceSnippet: "pojistné",
      },
    };

    applyExtractedFieldAliasNormalizations(env);

    expect(env.extractedFields.insurer?.value).toContain("Generali");
    expect(env.extractedFields.contractNumber?.value).toBe("3282880076");
    // normalizeExtractedFieldDates converts to ISO (internal/DB format); display is handled by mapper
    expect(env.extractedFields.policyStartDate?.value).toBe("2026-06-01");
    expect(String(env.extractedFields.investmentStrategy?.value)).toContain("dynamický");
    expect(env.extractedFields.totalMonthlyPremium?.value).toBe("4 166 Kč");

    const schema = selectSchemaForType("life_insurance_investment_contract");
    const { completeness, warnings } = runVerificationPass(env, schema);
    expect(completeness.requiredSatisfied).toBe(5);
    expect(completeness.requiredTotal).toBe(5);
    expect(warnings.filter((w) => w.code === "MISSING_REQUIRED_FIELD")).toHaveLength(0);
  });

  it("salvages contract fields from Czech text fragments when aliases are missing", () => {
    const env = minimalEnvelope("life_insurance_investment_contract");
    env.extractedFields = {
      title: {
        value: [
          "Modelace vývoje investičního životního pojištění",
          "Bel Mondo 20",
          "pojistná smlouva číslo 3282880076",
          "Počátek pojištění 1. 6. 2026",
          "Generali Česká pojišťovna a.s.",
        ].join("\n"),
        status: "inferred_low_confidence",
        confidence: 0.62,
      },
    };

    applyExtractedFieldAliasNormalizations(env);

    expect(env.extractedFields.insurer?.value).toContain("Generali");
    expect(env.extractedFields.productName?.value).toBe("Bel Mondo 20");
    expect(env.extractedFields.contractNumber?.value).toBe("3282880076");
    // normalizeExtractedFieldDates converts to ISO (internal/DB format); display is handled by mapper
    expect(env.extractedFields.policyStartDate?.value).toBe("2026-06-01");
  });

  it("fills proposalNumber_or_contractNumber for life_insurance_proposal", () => {
    const env = minimalEnvelope("life_insurance_proposal");
    env.documentClassification.lifecycleStatus = "proposal";
    env.documentClassification.documentIntent = "illustrative_only";
    env.extractedFields = {
      insurer: { value: "UNIQA", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      productName: { value: "Domino", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      documentStatus: { value: "návrh", status: "extracted", confidence: 0.8, evidenceSnippet: "x" },
      proposalNumber: { value: "PROP-001", status: "extracted", confidence: 0.85, evidenceSnippet: "x" },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.proposalNumber_or_contractNumber?.value).toBe("PROP-001");
    const schema = selectSchemaForType("life_insurance_proposal");
    const { completeness } = runVerificationPass(env, schema);
    expect(completeness.requiredSatisfied).toBe(schema.extractionRules.required.length);
  });

  it("maps consumer loan aliases to lender, loanAmount, installmentAmount", () => {
    const env = minimalEnvelope("consumer_loan_contract");
    env.extractedFields = {
      bankName: { value: "ČSOB", status: "extracted", confidence: 0.9, evidenceSnippet: "banka" },
      contractNumber: { value: "U-123", status: "extracted", confidence: 0.88, evidenceSnippet: "ref" },
      principal: { value: 500000, status: "extracted", confidence: 0.87, evidenceSnippet: "jistina" },
      monthlyInstallment: { value: "6 200 Kč", status: "extracted", confidence: 0.86, evidenceSnippet: "splátka" },
      numberOfInstallments: { value: 120, status: "extracted", confidence: 0.85, evidenceSnippet: "počet splátek" },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.lender?.value).toBe("ČSOB");
    expect(env.extractedFields.loanAmount?.value).toBe(500000);
    expect(env.extractedFields.installmentAmount?.value).toBe("6 200 Kč");
    expect(env.extractedFields.installmentCount?.value).toBe(120);
    const schema = selectSchemaForType("consumer_loan_contract");
    const { completeness, warnings } = runVerificationPass(env, schema);
    expect(completeness.requiredSatisfied).toBe(schema.extractionRules.required.length);
    expect(warnings.filter((w) => w.code === "MISSING_REQUIRED_FIELD")).toHaveLength(0);
  });

  it("synthesizes insuredObject for nonlife_insurance_contract from split vehicle / property fields", () => {
    const env = minimalEnvelope("nonlife_insurance_contract");
    env.extractedFields = {
      insurer: { value: "Test Pojišťovna", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      productName: { value: "Povinné ručení", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      contractNumber: { value: "NZ-1", status: "extracted", confidence: 0.88, evidenceSnippet: "x" },
      policyStartDate: { value: "2026-01-01", status: "extracted", confidence: 0.87, evidenceSnippet: "x" },
      spz: { value: "1A2 3456", status: "extracted", confidence: 0.86, evidenceSnippet: "SPZ" },
      vin: { value: "TMB12345678901234", status: "extracted", confidence: 0.85, evidenceSnippet: "VIN" },
      vehicleBrand: { value: "Škoda", status: "extracted", confidence: 0.84, evidenceSnippet: "značka" },
      vehicleModel: { value: "Octavia", status: "extracted", confidence: 0.84, evidenceSnippet: "model" },
      yearOfManufacture: { value: "2020", status: "extracted", confidence: 0.83, evidenceSnippet: "rok" },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(String(env.extractedFields.insuredObject?.value)).toMatch(/Škoda Octavia/);
    expect(String(env.extractedFields.insuredObject?.value)).toMatch(/SPZ:\s*1A2 3456/);
    expect(String(env.extractedFields.insuredObject?.value)).toMatch(/TMB12345678901234/);
    const schema = selectSchemaForType("nonlife_insurance_contract");
    const { completeness, warnings } = runVerificationPass(env, schema);
    expect(completeness.requiredSatisfied).toBe(schema.extractionRules.required.length);
    expect(warnings.filter((w) => w.code === "MISSING_REQUIRED_FIELD")).toHaveLength(0);
  });

  it("synthesizes insuredObject for nonlife from místo pojištění when insuredObject missing", () => {
    const env = minimalEnvelope("nonlife_insurance_contract");
    env.extractedFields = {
      insurer: { value: "Test Pojišťovna", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      productName: { value: "Pojištění domácnosti", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      contractNumber: { value: "DOM-9", status: "extracted", confidence: 0.88, evidenceSnippet: "x" },
      policyStartDate: { value: "2026-01-01", status: "extracted", confidence: 0.87, evidenceSnippet: "x" },
      mistoPojisteni: {
        value: "Praha 4, ul. Testovací 12",
        status: "extracted",
        confidence: 0.86,
        evidenceSnippet: "místo",
      },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(String(env.extractedFields.insuredObject?.value)).toContain("Praha 4");
    const schema = selectSchemaForType("nonlife_insurance_contract");
    const { warnings } = runVerificationPass(env, schema);
    expect(warnings.filter((w) => w.code === "MISSING_REQUIRED_FIELD")).toHaveLength(0);
  });

  it("investment_subscription_document: clears mistaken insurer; does not use bank account as contract number", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      insurer: { value: "Test Asset Management", status: "extracted", confidence: 0.75, evidenceSnippet: "x" },
      institutionName: { value: "Test Asset Management", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      accountNumber: { value: "123456789/0800", status: "extracted", confidence: 0.85, evidenceSnippet: "x" },
      cisloSmlouvy: { value: "INV-2026-42", status: "extracted", confidence: 0.88, evidenceSnippet: "x" },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.insurer?.status).toBe("not_applicable");
    expect(env.extractedFields.contractNumber?.value).toBe("INV-2026-42");
    expect(String(env.extractedFields.contractNumber?.value ?? "")).not.toMatch(/123456789/);
  });

  it("maps pension_contract provider and participantFullName aliases", () => {
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      institutionName: { value: "Penze Co", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      productName: { value: "DPS X", status: "extracted", confidence: 0.9, evidenceSnippet: "x" },
      contractNumber: { value: "DPS-9", status: "extracted", confidence: 0.88, evidenceSnippet: "x" },
      fullName: { value: "Jan Test", status: "extracted", confidence: 0.87, evidenceSnippet: "x" },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.provider?.value).toBe("Penze Co");
    expect(env.extractedFields.participantFullName?.value).toBe("Jan Test");
    const schema = selectSchemaForType("pension_contract");
    const { completeness } = runVerificationPass(env, schema);
    expect(completeness.requiredSatisfied).toBe(4);
  });
});

// ─── Lifecycle required fields: contract number / client / partner ─────────────
// These tests verify that the three fields pre-apply validation checks
// (contractNumber, fullName/investorName/etc, institutionName/provider/lender)
// are properly populated across lifecycle document families.

describe("lifecycle required fields — investment docs", () => {
  it("promotes investorFullName → fullName when LLM sets investorFullName only", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      investorFullName: { value: "Karel Novák", status: "extracted", confidence: 0.85 },
      provider: { value: "Amundi CR", status: "extracted", confidence: 0.88 },
      contractNumber: { value: "DIP-2026/42", status: "extracted", confidence: 0.82 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).toBe("Karel Novák");
    expect(env.extractedFields.institutionName?.value).toBe("Amundi CR");
  });

  it("promotes provider → institutionName for investment_service_agreement", () => {
    const env = minimalEnvelope("investment_service_agreement");
    env.extractedFields = {
      provider: { value: "Codya investiční společnost, a.s.", status: "extracted", confidence: 0.85 },
      clientFullName: { value: "Petr Patroch", status: "extracted", confidence: 0.82 },
      contractNumber: { value: "IS-12345", status: "extracted", confidence: 0.80 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.institutionName?.value).toContain("Codya");
    expect(env.extractedFields.fullName?.value).toBe("Petr Patroch");
    expect(env.extractedFields.investorFullName?.value).toBe("Petr Patroch");
  });

  it("does not use document title as contract number", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      contractNumber: { value: "Smlouva o úpisu cenných papírů", status: "extracted", confidence: 0.7 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.contractNumber?.status).toBe("missing");
  });
});

describe("lifecycle required fields — DPS / pension docs", () => {
  it("populates fullName + participantFullName from accountHolderName", () => {
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      accountHolderName: { value: "Jiří Plachý", status: "extracted", confidence: 0.85 },
      institutionName: { value: "KB Penzijní společnost, a.s.", status: "extracted", confidence: 0.88 },
      contractNumber: { value: "DPS-789", status: "extracted", confidence: 0.82 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).toBe("Jiří Plachý");
    expect(env.extractedFields.participantFullName?.value).toBe("Jiří Plachý");
    expect(env.extractedFields.provider?.value).toContain("KB Penzijní");
  });

  it("populates institutionName from pensionCompany alias", () => {
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      pensionCompany: { value: "Conseq penzijní společnost, a.s.", status: "extracted", confidence: 0.85 },
      fullName: { value: "Jan Novák", status: "extracted", confidence: 0.82 },
      contractNumber: { value: "DPS-001", status: "extracted", confidence: 0.80 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.provider?.value).toContain("Conseq");
    expect(env.extractedFields.institutionName?.value).toContain("Conseq");
  });
});

describe("lifecycle required fields — loan / mortgage docs", () => {
  it("promotes lender → institutionName for mortgage_document", () => {
    const env = minimalEnvelope("mortgage_document");
    env.extractedFields = {
      bankName: { value: "Česká spořitelna, a.s.", status: "extracted", confidence: 0.88 },
      dluznik: { value: "Marie Dvořáková", status: "extracted", confidence: 0.85 },
      cisloSmlouvy: { value: "HU-2026/1234", status: "extracted", confidence: 0.82 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.lender?.value).toContain("spořitelna");
    expect(env.extractedFields.institutionName?.value).toContain("spořitelna");
    expect(env.extractedFields.fullName?.value).toBe("Marie Dvořáková");
    expect(env.extractedFields.contractNumber?.value).toBe("HU-2026/1234");
  });

  it("promotes creditor → lender + institutionName for consumer_loan_contract", () => {
    const env = minimalEnvelope("consumer_loan_contract");
    env.extractedFields = {
      creditor: { value: "ČSOB, a.s.", status: "extracted", confidence: 0.88 },
      borrowerName: { value: "Tomáš Svoboda", status: "extracted", confidence: 0.85 },
      contractId: { value: "SU-999", status: "extracted", confidence: 0.82 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.lender?.value).toContain("ČSOB");
    expect(env.extractedFields.institutionName?.value).toContain("ČSOB");
    expect(env.extractedFields.fullName?.value).toBe("Tomáš Svoboda");
    expect(env.extractedFields.contractNumber?.value).toBe("SU-999");
  });
});

describe("lifecycle required fields — text salvage", () => {
  it("salvages contract number from evidence text for investment docs", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      someNotes: {
        value: "Smlouva číslo INV-2026/42 ze dne 1.3.2026",
        status: "extracted",
        confidence: 0.65,
        evidenceSnippet: "investor: Karel Novák, poskytovatel: Amundi CR, investiční společnost, a.s.",
      },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.contractNumber?.value).toBe("INV-2026/42");
  });

  it("salvages institution name from evidence snippet for pension docs", () => {
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      someField: {
        value: "Doplňkové penzijní spoření",
        status: "extracted",
        confidence: 0.6,
        evidenceSnippet: "KB Penzijní společnost, a.s. - smlouva o DPS, účastník: Jan Plachý",
      },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.institutionName?.value).toContain("KB Penzijní společnost");
  });

  it("does not confuse intermediary with client", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      investorFullName: { value: "Karel Novák", status: "extracted", confidence: 0.85 },
      intermediaryName: { value: "Karel Novák", status: "extracted", confidence: 0.7 },
      provider: { value: "Test Invest a.s.", status: "extracted", confidence: 0.88 },
      contractNumber: { value: "DIP-42", status: "extracted", confidence: 0.82 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.investorFullName?.value).toBe("Karel Novák");
    expect(env.extractedFields.intermediaryName?.status).toBe("not_applicable");
  });

  it("does not confuse institution with client name", () => {
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      fullName: { value: "KB Penzijní společnost, a.s.", status: "extracted", confidence: 0.7 },
      institutionName: { value: "KB Penzijní společnost, a.s.", status: "extracted", confidence: 0.88 },
      contractNumber: { value: "DPS-001", status: "extracted", confidence: 0.82 },
    };
    applyExtractedFieldAliasNormalizations(env);
    // field-source-priority should clear fullName if it's actually an institution
    // The institution field should stay
    expect(env.extractedFields.institutionName?.value).toContain("KB Penzijní");
  });
});

describe("lifecycle required fields — provider extraction generic", () => {
  it("extracts institution from text with a.s. / s.r.o. suffix", () => {
    const env = minimalEnvelope("investment_service_agreement");
    env.extractedFields = {
      description: {
        value: "Tato smlouva je uzavřena mezi Conseq Investment Management, a.s. a investorem",
        status: "extracted",
        confidence: 0.6,
      },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.institutionName?.value).toContain("Conseq");
  });

  it("does not hardcode specific vendors", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      provider: { value: "XYZ Hypothetical Invest, a.s.", status: "extracted", confidence: 0.85 },
      investorFullName: { value: "Test Osoba", status: "extracted", confidence: 0.82 },
      contractNumber: { value: "XYZ-001", status: "extracted", confidence: 0.80 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.institutionName?.value).toContain("XYZ Hypothetical");
    expect(env.extractedFields.fullName?.value).toBe("Test Osoba");
  });
});

// ─── Lifecycle header / parties / signatory promotion ────────────────────────

describe("lifecycle header/parties promotion into canonical required fields", () => {
  it("investment doc: provider + investorFullName + contractNumber propagate to canonical fields", () => {
    const env = minimalEnvelope("investment_service_agreement");
    env.extractedFields = {
      provider: { value: "Amundi Czech Republic, investiční společnost, a.s.", status: "extracted", confidence: 0.85 },
      investorFullName: { value: "Jan Plachý", status: "extracted", confidence: 0.82 },
      contractNumber: { value: "DIP-2024-001234", status: "extracted", confidence: 0.80 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.institutionName?.value).toContain("Amundi");
    expect(env.extractedFields.fullName?.value).toBe("Jan Plachý");
    expect(env.extractedFields.contractNumber?.value).toBe("DIP-2024-001234");
  });

  it("DPS doc: participantFullName + pensionCompany + contract number promote correctly", () => {
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      participantFullName: { value: "Karel Novák", status: "extracted", confidence: 0.85 },
      pensionCompany: { value: "KB Penzijní společnost, a.s.", status: "extracted", confidence: 0.87 },
      contractNumber: { value: "7001234567", status: "extracted", confidence: 0.80 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).toBe("Karel Novák");
    expect(env.extractedFields.institutionName?.value).toContain("KB Penzijní");
    expect(env.extractedFields.provider?.value).toContain("KB Penzijní");
    expect(env.extractedFields.contractNumber?.value).toBe("7001234567");
  });

  it("loan/mortgage doc: borrowerName + lender + contract number promote correctly", () => {
    const env = minimalEnvelope("mortgage_document");
    env.extractedFields = {
      borrowerName: { value: "Marie Svobodová", status: "extracted", confidence: 0.85 },
      lender: { value: "Hypoteční banka, a.s.", status: "extracted", confidence: 0.87 },
      contractNumber: { value: "HÚ-2023-987654", status: "extracted", confidence: 0.80 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).toBe("Marie Svobodová");
    expect(env.extractedFields.institutionName?.value).toContain("Hypoteční banka");
    expect(env.extractedFields.lender?.value).toContain("Hypoteční banka");
    expect(env.extractedFields.contractNumber?.value).toBe("HÚ-2023-987654");
  });

  it("consumer loan doc: borrower + lender aliases resolved", () => {
    const env = minimalEnvelope("consumer_loan_contract");
    env.extractedFields = {
      dluznik: { value: "Petr Čech", status: "extracted", confidence: 0.82 },
      veritel: { value: "Raiffeisenbank a.s.", status: "extracted", confidence: 0.86 },
      cisloSmlouvy: { value: "SU-999888", status: "extracted", confidence: 0.78 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.borrowerName?.value).toBe("Petr Čech");
    expect(env.extractedFields.fullName?.value).toBe("Petr Čech");
    expect(env.extractedFields.lender?.value).toContain("Raiffeisenbank");
    expect(env.extractedFields.institutionName?.value).toContain("Raiffeisenbank");
    expect(env.extractedFields.contractNumber?.value).toBe("SU-999888");
  });

  it("parties-sourced fullName propagates to domain-specific fields via final promotion", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.parties = {
      investor: {
        role: "investor",
        fullName: "Eva Mráčková",
        birthDate: "1985-03-15",
      },
      provider: {
        role: "provider",
        fullName: "Conseq Investment Management, a.s.",
      },
    };
    env.extractedFields = {
      contractNumber: { value: "CONS-2024-5678", status: "extracted", confidence: 0.80 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).toBe("Eva Mráčková");
    expect(env.extractedFields.investorFullName?.value).toBe("Eva Mráčková");
    expect(env.extractedFields.institutionName?.value).toContain("Conseq");
  });

  it("parties-sourced pension participant propagates to participantFullName", () => {
    const env = minimalEnvelope("pension_contract");
    env.parties = {
      participant: {
        role: "participant",
        fullName: "Tomáš Dvořák",
      },
      provider: {
        role: "provider",
        fullName: "Česká spořitelna - penzijní společnost, a.s.",
      },
    };
    env.extractedFields = {
      contractNumber: { value: "DPS-1234", status: "extracted", confidence: 0.78 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).toBe("Tomáš Dvořák");
    expect(env.extractedFields.participantFullName?.value).toBe("Tomáš Dvořák");
    expect(env.extractedFields.institutionName?.value).toContain("penzijní společnost");
  });
});

describe("anti-regression: role/value confusion guards", () => {
  it("document title is NOT used as contractNumber", () => {
    const env = minimalEnvelope("investment_service_agreement");
    env.extractedFields = {
      contractNumber: { value: "Smlouva o investičních službách", status: "extracted", confidence: 0.7 },
      fullName: { value: "Jan Novák", status: "extracted", confidence: 0.85 },
    };
    applyExtractedFieldAliasNormalizations(env);
    const cn = env.extractedFields.contractNumber;
    expect(cn?.status === "missing" || cn?.value === null || cn?.value === "").toBeTruthy();
  });

  it("intermediary name does NOT become client fullName", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      intermediaryName: { value: "Petr Poradce", status: "extracted", confidence: 0.85 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).not.toBe("Petr Poradce");
  });

  it("institution name does NOT become client fullName", () => {
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      institutionName: { value: "KB Penzijní společnost, a.s.", status: "extracted", confidence: 0.85 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.fullName?.value).not.toBe("KB Penzijní společnost, a.s.");
  });

  it("role label 'Investor' is NOT extracted as a person name", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      investorFullName: { value: "Investor", status: "extracted", confidence: 0.6 },
      provider: { value: "Test Fond, a.s.", status: "extracted", confidence: 0.85 },
    };
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.investorFullName?.value).not.toBe("Investor");
    expect(env.extractedFields.fullName?.value).not.toBe("Investor");
  });
});

describe("pre-apply validation checks investorFullName and clientFullName", () => {
  it("investorFullName satisfies policyholder_name_required", async () => {
    const { validateBeforeApply } = await import("../pre-apply-validation");
    const env = minimalEnvelope("investment_service_agreement");
    env.extractedFields = {
      investorFullName: { value: "Jan Novák", status: "extracted", confidence: 0.85 },
      contractNumber: { value: "INV-001", status: "extracted", confidence: 0.80 },
      institutionName: { value: "XYZ Invest, a.s.", status: "extracted", confidence: 0.85 },
    };
    const result = validateBeforeApply(env, "INV");
    const nameIssue = result.issues.find(i => i.rule === "policyholder_name_required");
    expect(nameIssue).toBeUndefined();
  });

  it("clientFullName satisfies policyholder_name_required", async () => {
    const { validateBeforeApply } = await import("../pre-apply-validation");
    const env = minimalEnvelope("pension_contract");
    env.extractedFields = {
      clientFullName: { value: "Eva Novotná", status: "extracted", confidence: 0.85 },
      contractNumber: { value: "DPS-001", status: "extracted", confidence: 0.80 },
      provider: { value: "XYZ Penzijní, a.s.", status: "extracted", confidence: 0.85 },
    };
    const result = validateBeforeApply(env, "DPS");
    const nameIssue = result.issues.find(i => i.rule === "policyholder_name_required");
    expect(nameIssue).toBeUndefined();
  });
});

describe("runVerificationPass readability", () => {
  it("skips LOW_EVIDENCE_REQUIRED on text_pdf with good coverage when value present and confidence ok", () => {
    const env = minimalEnvelope("life_insurance_investment_contract");
    env.documentMeta.textCoverageEstimate = 0.92;
    env.documentMeta.preprocessStatus = "ok";
    env.extractedFields = {
      insurer: { value: "X", status: "extracted", confidence: 0.72 },
      productName: { value: "Y", status: "extracted", confidence: 0.72 },
      contractNumber: { value: "1", status: "extracted", confidence: 0.72 },
      policyStartDate: { value: "2026-01-01", status: "extracted", confidence: 0.72 },
      investmentStrategy: { value: "mixed", status: "extracted", confidence: 0.72 },
    };

    const schema = selectSchemaForType("life_insurance_investment_contract");
    const { warnings } = runVerificationPass(env, schema, {
      readability: {
        inputMode: "text_pdf",
        textCoverageEstimate: 0.92,
        preprocessStatus: "ok",
      },
    });
    expect(warnings.filter((w) => w.code === "LOW_EVIDENCE_REQUIRED")).toHaveLength(0);
  });
});

describe("salvageLifecycleRequiredFieldsFromText — insurance document types", () => {
  it("salvages contractNumber for life_insurance_contract from evidence snippets", () => {
    const env = minimalEnvelope("life_insurance_contract");
    env.extractedFields = {
      productName: {
        value: "Flexi životní pojištění",
        status: "extracted",
        confidence: 0.9,
        evidenceSnippet: "Pojistná smlouva číslo INS998877. Pojistník: Karel Dvořák",
      },
    } as never;
    applyExtractedFieldAliasNormalizations(env);
    const ef = env.extractedFields as Record<string, { value?: unknown }>;
    expect(ef.contractNumber?.value).toBeTruthy();
  });

  it("salvages client name for nonlife_insurance_contract from evidence snippets", () => {
    const env = minimalEnvelope("nonlife_insurance_contract");
    env.extractedFields = {
      productName: {
        value: "Autopojištění Optimum",
        status: "extracted",
        confidence: 0.85,
        evidenceSnippet: "Číslo smlouvy: NP123456 pojistník: Marie Nováková Pojišťovna: Kooperativa",
      },
    } as never;
    applyExtractedFieldAliasNormalizations(env);
    const ef = env.extractedFields as Record<string, { value?: unknown }>;
    const hasClient =
      ef.policyholderName?.value || ef.fullName?.value || ef.clientFullName?.value;
    expect(hasClient).toBeTruthy();
  });

  it("does NOT salvage for non-lifecycle document types", () => {
    const env = minimalEnvelope("payroll_statement" as never);
    env.extractedFields = {
      someField: {
        value: "data",
        status: "extracted",
        confidence: 0.9,
        evidenceSnippet: "Smlouva číslo: X999999 Pojistník: Test Test",
      },
    } as never;
    applyExtractedFieldAliasNormalizations(env);
    const ef = env.extractedFields as Record<string, { value?: unknown }>;
    expect(ef.contractNumber?.value).toBeUndefined();
  });
});
