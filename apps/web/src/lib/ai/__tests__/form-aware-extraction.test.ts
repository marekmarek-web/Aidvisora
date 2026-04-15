import { describe, expect, it } from "vitest";
import type { DocumentReviewEnvelope } from "../document-review-types";
import type { PdfFormFieldRow } from "@/lib/documents/processing/pdf-acroform-extract";
import { advisorFieldLabelForKey } from "@/lib/ai-review/mappers";
import {
  applyPdfFormFieldTruthToEnvelope,
  buildPdfFormFieldPromptBlock,
  isPlausibleLabelOnlyValue,
  stripLabelOnlyExtractionValues,
} from "../form-aware-extraction";

function minimalEnvelope(primary: DocumentReviewEnvelope["documentClassification"]["primaryType"]): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType: primary,
      lifecycleStatus: "final_contract",
      documentIntent: "creates_new_product",
      confidence: 0.9,
      reasons: [],
    },
    documentMeta: {
      scannedVsDigital: "digital",
      fileName: "x.pdf",
      pageCount: 1,
      issuer: null,
      documentDate: null,
      language: "cs",
      overallConfidence: 0.9,
    },
    extractedFields: {},
    parties: {},
    reviewWarnings: [],
    suggestedActions: [],
  };
}

describe("form-aware extraction", () => {
  it("rejects label Investor as a client name", () => {
    expect(isPlausibleLabelOnlyValue("Investor")).toBe(true);
    expect(isPlausibleLabelOnlyValue("Jiří Chlumecký")).toBe(false);
  });

  it("rejects contract column label as contract number value", () => {
    expect(isPlausibleLabelOnlyValue("číslo smlouvy Investora")).toBe(true);
    expect(isPlausibleLabelOnlyValue("71748")).toBe(false);
  });

  it("rejects document title placeholder as contract number (Smlouva o úpisu)", () => {
    expect(isPlausibleLabelOnlyValue("Smlouva o úpisu")).toBe(true);
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      contractNumber: { value: "Smlouva o úpisu", status: "extracted", confidence: 0.5 },
    };
    stripLabelOnlyExtractionValues(env);
    expect(env.extractedFields.contractNumber?.status).toBe("missing");
  });

  it("strips role labels from policyholder name fields", () => {
    const env = minimalEnvelope("life_insurance_final_contract");
    env.extractedFields = {
      policyholderName: { value: "Pojistník", status: "extracted", confidence: 0.4 },
    };
    stripLabelOnlyExtractionValues(env);
    expect(env.extractedFields.policyholderName?.status).toBe("missing");
  });

  it("prefers AcroForm field over conflicting layout extraction", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      investorFullName: { value: "Investor", status: "extracted", confidence: 0.5 },
      contractNumber: { value: "číslo smlouvy Investora", status: "extracted", confidence: 0.5 },
    };
    const rows: PdfFormFieldRow[] = [
      { page: 1, fieldName: "customer.joinedName", fieldValue: "Jiří Chlumecký" },
      { page: 1, fieldName: "no", fieldValue: "71748" },
    ];
    env.debug = { pdfAcroFormFields: rows };
    stripLabelOnlyExtractionValues(env);
    applyPdfFormFieldTruthToEnvelope(env, rows);
    expect(env.extractedFields.investorFullName?.value).toBe("Jiří Chlumecký");
    expect(env.extractedFields.contractNumber?.value).toBe("71748");
  });

  it("does not map distributor/consultant form fields into client identity", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      fullName: { value: "BEplan finanční plánování s.r.o.", status: "extracted", confidence: 0.4 },
    };
    const rows: PdfFormFieldRow[] = [
      { page: 1, fieldName: "customer.joinedName", fieldValue: "Jiří Chlumecký" },
      { page: 5, fieldName: "consultant.company.name", fieldValue: "BEplan finanční plánování s.r.o." },
    ];
    env.debug = { pdfAcroFormFields: rows };
    stripLabelOnlyExtractionValues(env);
    applyPdfFormFieldTruthToEnvelope(env, rows);
    expect(env.extractedFields.fullName?.value).toBe("Jiří Chlumecký");
    expect(env.extractedFields.intermediaryCompany?.value).toBe("BEplan finanční plánování s.r.o.");
  });

  it("maps distributor.* prefix to intermediary, not client name", () => {
    const env = minimalEnvelope("investment_subscription_document");
    env.extractedFields = {
      fullName: { value: "Jan Zprostředkovatel", status: "extracted", confidence: 0.3 },
    };
    const rows: PdfFormFieldRow[] = [
      { page: 1, fieldName: "customer.joinedName", fieldValue: "Marie Klientová" },
      { page: 2, fieldName: "distributor.person.name", fieldValue: "Jan Zprostředkovatel" },
    ];
    env.debug = { pdfAcroFormFields: rows };
    stripLabelOnlyExtractionValues(env);
    applyPdfFormFieldTruthToEnvelope(env, rows);
    expect(env.extractedFields.fullName?.value).toBe("Marie Klientová");
    expect(env.extractedFields.intermediaryName?.value).toBe("Jan Zprostředkovatel");
  });

  it("maps identity document fields from form payload", () => {
    const env = minimalEnvelope("investment_subscription_document");
    const rows: PdfFormFieldRow[] = [
      { page: 1, fieldName: "customer.document.joinedId", fieldValue: "OP213038282" },
      { page: 1, fieldName: "customer.document.issuedBy", fieldValue: "Roudnice nad Labem" },
      { page: 1, fieldName: "customer.document.validity", fieldValue: "04.06.2031" },
    ];
    env.debug = { pdfAcroFormFields: rows };
    applyPdfFormFieldTruthToEnvelope(env, rows);
    expect(env.extractedFields.idCardNumber?.value).toBe("OP213038282");
    expect(env.extractedFields.idCardIssuedBy?.value).toBe("Roudnice nad Labem");
    expect(env.extractedFields.idCardValidUntil?.value).toBe("04.06.2031");
  });

  it("maps estimated investment amount when present", () => {
    const env = minimalEnvelope("investment_subscription_document");
    const rows: PdfFormFieldRow[] = [
      { page: 1, fieldName: "investmentEstimatedAmount", fieldValue: "2 000 000,00 Kč" },
    ];
    env.debug = { pdfAcroFormFields: rows };
    applyPdfFormFieldTruthToEnvelope(env, rows);
    expect(String(env.extractedFields.oneOffAmount?.value)).toContain("000");
  });

  it("maps internal fundStrategy key to Czech advisor label in UI layer", () => {
    expect(advisorFieldLabelForKey("fundStrategy")).toBe("Investiční strategie");
  });

  it("does not surface raw internal enum tokens as field labels (Czech mapping)", () => {
    expect(advisorFieldLabelForKey("policyholder")).toBe("Pojistník");
    expect(advisorFieldLabelForKey("policyholder")).not.toMatch(/^[a-z_]+$/);
  });

  it("emits Czech form-truth preamble for the extraction prompt", () => {
    const block = buildPdfFormFieldPromptBlock([
      { page: 1, fieldName: "customer.joinedName", fieldValue: "Test" },
    ]);
    expect(block).toContain("VYPLNĚNÁ PDF FORMULÁŘOVÁ POLE");
    expect(block).toContain("AcroForm");
    expect(block).toContain("customer.joinedName");
  });
});
