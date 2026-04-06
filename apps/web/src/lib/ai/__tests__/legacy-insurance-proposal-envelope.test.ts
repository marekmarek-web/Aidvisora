import { describe, expect, it } from "vitest";
import { validateExtractionByType } from "../extraction-schemas-by-type";
import type { ClassificationResult } from "../document-classification";
import {
  buildEnvelopeFromLegacyInsuranceProposalJson,
  isLegacyInsuranceProposalPayload,
  maybeRewriteInsuranceProposalExtractionRaw,
} from "../legacy-insurance-proposal-envelope";
import { buildAllDraftActions } from "../draft-actions";

const classification: ClassificationResult = {
  primaryType: "life_insurance_modelation",
  lifecycleStatus: "modelation",
  documentIntent: "illustrative_only",
  confidence: 0.88,
  reasons: ["modelace_z_pdf"],
  subtype: "investment_life_insurance",
};

describe("legacy-insurance-proposal-envelope", () => {
  it("detects legacy hosted-prompt shape", () => {
    const parsed = JSON.parse(`{
      "documentType": "life_insurance_modelation",
      "normalizedSubtype": "insurance_modelation",
      "institutionName": "Generali",
      "productName": "Bel Mondo 20",
      "proposalNumber": "3282880076",
      "client": { "fullName": "Hanna Havdan", "birthDate": "9.11.1983" },
      "illustrativePaymentDetails": { "monthlyPremium": 2500, "frequency": "měsíčně" }
    }`) as Record<string, unknown>;
    expect(isLegacyInsuranceProposalPayload(parsed)).toBe(true);
  });

  it("does not flag valid envelope with populated extractedFields", () => {
    const parsed = JSON.parse(`{
      "documentClassification": {
        "primaryType": "life_insurance_modelation",
        "lifecycleStatus": "modelation",
        "confidence": 0.9,
        "reasons": []
      },
      "documentMeta": { "scannedVsDigital": "digital" },
      "extractedFields": {
        "insurer": { "value": "X", "status": "extracted", "confidence": 0.9 },
        "productName": { "value": "Y", "status": "extracted", "confidence": 0.9 },
        "modelationId": { "value": "1", "status": "extracted", "confidence": 0.9 }
      }
    }`) as Record<string, unknown>;
    expect(isLegacyInsuranceProposalPayload(parsed)).toBe(false);
  });

  it("buildEnvelopeFromLegacyInsuranceProposalJson produces schema-valid envelope", () => {
    const parsed = JSON.parse(`{
      "institutionName": "Generali Česká pojišťovna a.s.",
      "productName": "Bel Mondo 20",
      "proposalNumber": "3282880076",
      "client": {
        "fullName": "Hanna Havdan",
        "birthDate": "9.11.1983",
        "address": "Konečná 1523/14, Mělník",
        "phone": "+420602000000",
        "email": "test@example.com"
      },
      "illustrativePaymentDetails": {
        "monthlyPremium": 2500,
        "frequency": "měsíčně",
        "iban": "CZ6508000000197400145399",
        "variableSymbol": "3282880076"
      },
      "intermediary": { "name": "Marek Marek", "phone": "777888999", "email": "poradce@example.com" },
      "insuredPersons": [{ "fullName": "Hanna Havdan", "coverages": ["smrt", "invalidita"] }],
      "selectedCoverages": ["Smrt", "Závažná onemocnění"],
      "importantNotes": "Nezávazná modelace."
    }`) as Record<string, unknown>;

    const env = buildEnvelopeFromLegacyInsuranceProposalJson(parsed, {
      documentType: "life_insurance_modelation",
      classification,
      normalizedPipeline: "insurance_modelation",
    });
    expect(env).not.toBeNull();
    if (!env) return;

    const raw = JSON.stringify(env);
    const v = validateExtractionByType(raw, "life_insurance_modelation");
    expect(v.ok).toBe(true);
    if (!v.ok) return;

    expect(v.data.extractedFields.fullName?.value).toBe("Hanna Havdan");
    expect(v.data.extractedFields.insurer?.value).toContain("Generali");
    expect(v.data.extractedFields.modelationId?.value).toBe("3282880076");
    expect(v.data.extractedFields.totalMonthlyPremium?.value).toBe(2500);
    expect(v.data.extractedFields.intermediaryName?.value).toBe("Marek Marek");
    expect(Array.isArray(v.data.extractedFields.insuredPersons?.value)).toBe(true);
    expect(v.data.reviewWarnings.some((w) => w.message.includes("Nezávazná"))).toBe(true);
  });

  it("modelation envelope triggers client and payment setup draft actions", () => {
    const parsed = JSON.parse(`{
      "institutionName": "Generali",
      "productName": "Bel Mondo",
      "proposalNumber": "123",
      "client": { "fullName": "Jan Novák", "email": "j@x.cz" },
      "illustrativePaymentDetails": { "iban": "CZ123" }
    }`) as Record<string, unknown>;
    const env = buildEnvelopeFromLegacyInsuranceProposalJson(parsed, {
      documentType: "life_insurance_modelation",
      classification,
      normalizedPipeline: "insurance_modelation",
    });
    expect(env).not.toBeNull();
    const actions = buildAllDraftActions(env!);
    expect(actions.some((a) => a.type === "create_client")).toBe(true);
    expect(actions.some((a) => a.type === "create_payment_setup")).toBe(true);
  });

  it("maybeRewriteInsuranceProposalExtractionRaw upgrades legacy string to valid envelope", () => {
    const raw = JSON.stringify({
      institutionName: "TestIns",
      productName: "Prod",
      proposalNumber: "999",
      client: { fullName: "A B" },
    });
    const out = maybeRewriteInsuranceProposalExtractionRaw(raw, {
      promptKey: "insuranceProposalModelation",
      documentType: "life_insurance_modelation",
      classification,
      normalizedPipeline: "insurance_modelation",
    });
    const v = validateExtractionByType(out, "life_insurance_modelation");
    expect(v.ok).toBe(true);
  });

  it("upgrades production-shaped hosted JSON (responseKeys like soft_fail log) to many extractedFields", () => {
    const legacy = {
      documentType: "insurance_proposal_or_modelation",
      documentTypeLabel: "Návrh nebo modelace pojištění",
      normalizedSubtype: "insurance_modelation",
      subtypeLabel: "Modelace investičního životního pojištění",
      institutionName: "Pojišťovna A",
      productName: "Produkt B",
      proposalNumber: "1234567890",
      client: {
        fullName: "Jan Testovací",
        birthDate: "1.1.1980",
        personalId: "8001011234",
        address: "Ulice 1, Město",
        phone: "+420111222333",
        email: "jan@example.test",
        occupation: "IT",
        sports: "cyklistika",
      },
      illustrativePaymentDetails: {
        amount: 3000,
        currency: "CZK",
        paymentFrequency: "měsíčně",
        iban: "CZ0000000000000000000000",
        variableSymbol: "1234567890",
        bankCode: "0800",
      },
      importantNotes: "Ilustrační dokument.",
      isFinalContract: false,
      canBeAppliedDirectly: false,
      missingFields: ["sports_detail"],
      warnings: ["Ověřte údaje oproti originálu."],
      sectionConfidence: {
        classification: 0.85,
        client: 0.8,
        paymentDetails: 0.7,
      },
      needsHumanReview: true,
    };
    const raw = JSON.stringify(legacy);
    const out = maybeRewriteInsuranceProposalExtractionRaw(raw, {
      promptKey: "insuranceProposalModelation",
      documentType: "life_insurance_modelation",
      classification,
      normalizedPipeline: "insurance_modelation",
    });
    const v = validateExtractionByType(out, "life_insurance_modelation");
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const keys = Object.keys(v.data.extractedFields ?? {});
    expect(keys.length).toBeGreaterThanOrEqual(12);
    expect(v.data.extractedFields.fullName?.value).toBe("Jan Testovací");
    expect(v.data.extractedFields.totalMonthlyPremium?.value).toBe(3000);
    expect(v.data.extractedFields.productType?.value).toContain("Modelace");
    expect(v.data.reviewWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("maybeRewriteInsuranceProposalExtractionRaw leaves other prompts unchanged", () => {
    const raw = `{"documentClassification":{"primaryType":"life_insurance_contract","lifecycleStatus":"final_contract","confidence":0.9,"reasons":[]},"documentMeta":{"scannedVsDigital":"digital"},"extractedFields":{}}`;
    const out = maybeRewriteInsuranceProposalExtractionRaw(raw, {
      promptKey: "insuranceContractExtraction",
      documentType: "life_insurance_contract",
      classification: { ...classification, primaryType: "life_insurance_contract", lifecycleStatus: "final_contract" },
      normalizedPipeline: "life_insurance_contract",
    });
    expect(out).toBe(raw);
  });
});
