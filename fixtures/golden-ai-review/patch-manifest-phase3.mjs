/**
 * Phase 3 manifest patch:
 * 1. Adds aliasFileNames to existing corpus entries where the local PDF has a different name.
 * 2. Adds new C030-C041 entries for PDFs present in Test AI/ but not yet in manifest.
 * 3. Bumps version to 4.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "scenarios.manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// ─── 1. Add aliasFileNames for existing entries ───────────────────────────────

const ALIAS_MAP = {
  C001: ["Test AI/smlouva o poskytnutí hypotečního úvěru - návrh.pdf"],
  C003: ["Test AI/Modelace životního pojištění.pdf"],
  C004: ["Test AI/AMUNDI DIP.pdf"],
  C005: ["Test AI/Smlouva DPS.pdf"],
  C007: ["Test AI/Modelace životního pojištění Kooperativa.pdf"],
  C022: ["Test AI/Výplatní lístek za měsíc.pdf"],
  C023: ["Test AI/Komisionářská smlouva scan.pdf"],
};

let aliasUpdated = 0;
for (const doc of manifest.corpusDocuments) {
  const aliases = ALIAS_MAP[doc.id];
  if (!aliases) continue;
  const existing = new Set(doc.aliasFileNames ?? []);
  for (const a of aliases) existing.add(a);
  doc.aliasFileNames = [...existing];
  aliasUpdated++;
}

// ─── 2. Add new corpus documents ─────────────────────────────────────────────

const NEW_DOCS = [
  {
    id: "C030",
    familyBucket: "life_insurance",
    referenceFile: "Test AI/IŽP - Generali.pdf",
    gitTracked: false,
    expectedPrimaryType: "life_insurance_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "life_insurance",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "standard",
    expectedClientBindingType: "policy",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "totalMonthlyPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client", "set_review_reminder"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "IŽP Generali — extrahuj klientská data z bloku pojistník/pojištěný, ne z hlavičky Generali.",
  },
  {
    id: "C031",
    familyBucket: "life_insurance",
    referenceFile: "Test AI/IŽP UNIQA.PDF",
    gitTracked: false,
    expectedPrimaryType: "life_insurance_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "life_insurance",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "standard",
    expectedClientBindingType: "policy",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "totalMonthlyPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "IŽP UNIQA — klient z bloku pojistník, ne z UNIQA logotypu/adresy.",
  },
  {
    id: "C032",
    familyBucket: "life_insurance",
    referenceFile: "Test AI/Životní pojištění Pillow.pdf",
    gitTracked: false,
    expectedPrimaryType: "life_insurance_proposal",
    publishable: "partial",
    isPacket: false,
    expectedFamily: "life_insurance",
    expectedOutputMode: "signature_ready_proposal",
    expectedPublishability: "partial",
    expectedSensitivity: "standard",
    expectedClientBindingType: "proposal",
    expectedCoreFields: [
      "fullName", "proposalNumber", "insurer", "productName",
      "policyStartDate", "totalMonthlyPremium"
    ],
    expectedActionsAllowed: ["review_proposal", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Pillow digitální životní pojištění — návrh/signature-ready. Klientská data z bloku pojistník/žadatel.",
  },
  {
    id: "C033",
    familyBucket: "life_insurance",
    referenceFile: "Test AI/Životní pojištění Uniqa.pdf",
    gitTracked: false,
    expectedPrimaryType: "life_insurance_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "life_insurance",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "standard",
    expectedClientBindingType: "policy",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "totalMonthlyPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Životní pojištění Uniqa — finální smlouva, klientská data z pojistník bloku.",
  },
  {
    id: "C034",
    familyBucket: "non_life_insurance",
    referenceFile: "Test AI/Pojištění podnikatelů.pdf",
    gitTracked: false,
    expectedPrimaryType: "non_life_insurance_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "non_life_insurance",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "standard",
    expectedClientBindingType: "policy",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "totalMonthlyPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Pojištění podnikatelů — non-life, extrahuj předmět pojištění a rizika.",
  },
  {
    id: "C035",
    familyBucket: "non_life_insurance",
    referenceFile: "Test AI/Pojištění odpovědnosti v zaměstnání.pdf",
    gitTracked: false,
    expectedPrimaryType: "non_life_insurance_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "non_life_insurance",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "standard",
    expectedClientBindingType: "policy",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Pojištění odpovědnosti v zaměstnání — liability insurance.",
  },
  {
    id: "C036",
    familyBucket: "non_life_insurance",
    referenceFile: "Test AI/Povinné ručení.pdf",
    gitTracked: false,
    expectedPrimaryType: "non_life_insurance_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "non_life_insurance",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "standard",
    expectedClientBindingType: "policy",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "totalMonthlyPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Povinné ručení (MTPL) — motor third-party liability.",
  },
  {
    id: "C037",
    familyBucket: "non_life_insurance",
    referenceFile: "Test AI/Uniqa Majetek.pdf",
    gitTracked: false,
    expectedPrimaryType: "non_life_insurance_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "non_life_insurance",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "standard",
    expectedClientBindingType: "policy",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "totalMonthlyPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Uniqa Majetek — property/home insurance.",
  },
  {
    id: "C038",
    familyBucket: "mortgage",
    referenceFile: "Test AI/Hypotéka.pdf",
    gitTracked: false,
    expectedPrimaryType: "mortgage_document",
    publishable: true,
    isPacket: false,
    expectedFamily: "mortgage",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "financial_data",
    expectedClientBindingType: "loan_agreement",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "annualPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Hypotéka — mortgage document, extrahuj výši úvěru, splatnost, splátku.",
  },
  {
    id: "C039",
    familyBucket: "consumer_credit",
    referenceFile: "Test AI/SMLOUVA O ÚVĚRU.pdf",
    gitTracked: false,
    expectedPrimaryType: "consumer_loan_contract",
    publishable: true,
    isPacket: false,
    expectedFamily: "consumer_credit",
    expectedOutputMode: "structured_product_document",
    expectedPublishability: true,
    expectedSensitivity: "financial_data",
    expectedClientBindingType: "loan_agreement",
    expectedCoreFields: [
      "fullName", "contractNumber", "insurer", "productName",
      "policyStartDate", "annualPremium"
    ],
    expectedActionsAllowed: ["publish_contract", "match_client"],
    expectedActionsForbidden: ["mark_as_reference_only"],
    expectedNotesForAdvisor: "Smlouva o úvěru — consumer credit, extrahuj výši úvěru, RPSN, splátku.",
  },
  {
    id: "C040",
    familyBucket: "compliance",
    referenceFile: "Test AI/Daňové přiznání s.r.o..pdf",
    gitTracked: false,
    expectedPrimaryType: "corporate_tax_return",
    publishable: false,
    isPacket: false,
    expectedFamily: "compliance",
    expectedOutputMode: "reference_or_supporting_document",
    expectedPublishability: false,
    expectedSensitivity: "financial_data",
    expectedClientBindingType: "none",
    expectedCoreFields: ["documentSummary"],
    expectedActionsAllowed: ["flag_for_review", "attach_to_client_file"],
    expectedActionsForbidden: ["publish_as_insurance_contract", "auto_publish"],
    expectedNotesForAdvisor: "Daňové přiznání s.r.o. — reference dokument. Nevkládat do smluvní pipeline.",
    expectedFallbackBehavior: {
      expectedSummaryFocus: "tax_return_period_and_company",
      expectedPurposeHint: "income_verification_or_compliance",
      recommendedNextStep: "attach_to_client_profile_as_reference",
      noProductPublishPayload: true,
    },
  },
  {
    id: "C041",
    familyBucket: "compliance",
    referenceFile: "Test AI/PŘIZNÁNÍ k dani z příjmů právnických osob.pdf",
    gitTracked: false,
    expectedPrimaryType: "corporate_tax_return",
    publishable: false,
    isPacket: false,
    expectedFamily: "compliance",
    expectedOutputMode: "reference_or_supporting_document",
    expectedPublishability: false,
    expectedSensitivity: "financial_data",
    expectedClientBindingType: "none",
    expectedCoreFields: ["documentSummary"],
    expectedActionsAllowed: ["flag_for_review", "attach_to_client_file"],
    expectedActionsForbidden: ["publish_as_insurance_contract", "auto_publish"],
    expectedNotesForAdvisor: "DPPO (daň z příjmů právnických osob) — reference dokument pro příjmovou verifikaci.",
    expectedFallbackBehavior: {
      expectedSummaryFocus: "tax_period_company_and_taxable_income",
      expectedPurposeHint: "income_or_compliance_verification",
      recommendedNextStep: "attach_to_client_profile_as_reference",
      noProductPublishPayload: true,
    },
  },
];

// Only add docs that don't already exist
const existingIds = new Set(manifest.corpusDocuments.map((d) => d.id));
let added = 0;
for (const doc of NEW_DOCS) {
  if (!existingIds.has(doc.id)) {
    manifest.corpusDocuments.push(doc);
    added++;
  }
}

// ─── 3. Update version and description ───────────────────────────────────────

manifest.version = 4;
manifest.description =
  "Phase 1–3: G01–G12 + corpusDocuments C001–C041. Phase 3: live corpus eval, aliasFileNames for renamed PDFs, C030-C041 new entries (non-life, mortgage, consumer credit, tax returns). Phase 1 golden: expectedOutputMode, expectedCoreFields, release gate.";

// ─── 4. Write updated manifest ───────────────────────────────────────────────

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`✅ Manifest updated: version=${manifest.version}, docs=${manifest.corpusDocuments.length}, aliasUpdates=${aliasUpdated}, newDocs=${added}`);
