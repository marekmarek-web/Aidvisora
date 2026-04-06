/**
 * Phase 3b: Fix new corpus entries (C030-C041) to use valid familyBucket and expectedSensitivity values.
 * Also add required legacy fields so manifest schema tests pass.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "scenarios.manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const FIXES = {
  C030: {
    familyBucket: "final_life_contract",
    expectedSensitivity: "standard",
    expectedClientBindingType: "insured_policyholder_block_not_insurer_header",
    expectedEntities: ["policyholder", "insurer", "product"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "premiumAmount", "paymentFrequency"],
    expectedForbiddenActions: ["apply_as_modelation_without_override", "use_insurer_address_as_client"],
    expectedReviewFlags: ["review_client_block_priority"],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C031: {
    familyBucket: "final_life_contract",
    expectedSensitivity: "standard",
    expectedClientBindingType: "insured_policyholder_block_not_insurer_header",
    expectedEntities: ["policyholder", "insurer", "product"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "premiumAmount", "paymentFrequency"],
    expectedForbiddenActions: ["apply_as_modelation_without_override", "use_insurer_address_as_client"],
    expectedReviewFlags: ["review_client_block_priority"],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C032: {
    familyBucket: "life_proposal",
    expectedSensitivity: "standard",
    expectedClientBindingType: "insured_policyholder_block_not_insurer_header",
    expectedEntities: ["policyholder", "insurer", "product"],
    expectedExtractedFields: ["proposalNumber", "institutionName", "productName", "effectiveDate", "premiumAmount", "paymentFrequency"],
    expectedForbiddenActions: ["auto_publish_as_final_contract"],
    expectedReviewFlags: ["review_as_proposal"],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C033: {
    familyBucket: "final_life_contract",
    expectedSensitivity: "standard",
    expectedClientBindingType: "insured_policyholder_block_not_insurer_header",
    expectedEntities: ["policyholder", "insurer", "product"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "premiumAmount", "paymentFrequency"],
    expectedForbiddenActions: ["apply_as_modelation_without_override", "use_insurer_address_as_client"],
    expectedReviewFlags: ["review_client_block_priority"],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C034: {
    familyBucket: "non_life_insurance",
    expectedSensitivity: "standard",
    expectedClientBindingType: "policyholder_block",
    expectedEntities: ["policyholder", "insurer", "product"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "premiumAmount"],
    expectedForbiddenActions: ["use_insurer_address_as_client"],
    expectedReviewFlags: [],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C035: {
    familyBucket: "non_life_insurance",
    expectedSensitivity: "standard",
    expectedClientBindingType: "policyholder_block",
    expectedEntities: ["policyholder", "insurer", "product"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate"],
    expectedForbiddenActions: ["use_insurer_address_as_client"],
    expectedReviewFlags: [],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C036: {
    familyBucket: "non_life_insurance",
    expectedSensitivity: "standard",
    expectedClientBindingType: "policyholder_block",
    expectedEntities: ["policyholder", "insurer", "vehicle"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "premiumAmount"],
    expectedForbiddenActions: ["use_insurer_address_as_client"],
    expectedReviewFlags: [],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C037: {
    familyBucket: "non_life_insurance",
    expectedSensitivity: "standard",
    expectedClientBindingType: "policyholder_block",
    expectedEntities: ["policyholder", "insurer", "insuredProperty"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "premiumAmount"],
    expectedForbiddenActions: ["use_insurer_address_as_client"],
    expectedReviewFlags: [],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C038: {
    familyBucket: "mortgage_or_mortgage_proposal",
    expectedSensitivity: "standard",
    expectedClientBindingType: "borrower_block",
    expectedEntities: ["borrower", "lender", "product"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "annualPremium"],
    expectedForbiddenActions: ["use_lender_address_as_client"],
    expectedReviewFlags: ["review_loan_amount_and_term"],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C039: {
    familyBucket: "consumer_loan",
    expectedSensitivity: "standard",
    expectedClientBindingType: "borrower_block",
    expectedEntities: ["borrower", "lender", "product"],
    expectedExtractedFields: ["contractNumber", "institutionName", "productName", "effectiveDate", "annualPremium"],
    expectedForbiddenActions: ["use_lender_address_as_client"],
    expectedReviewFlags: ["review_loan_amount_and_term"],
    expectedAssistantRelevance: "post_upload_plan",
    mapsToGoldenScenarioIds: [],
  },
  C040: {
    familyBucket: "service_or_aml_or_supporting_doc",
    expectedSensitivity: "high_sensitivity",
    expectedClientBindingType: "none",
    expectedEntities: ["company", "taxAuthority"],
    expectedExtractedFields: ["taxPeriod", "companyName"],
    expectedForbiddenActions: ["publish_as_insurance_contract", "auto_publish"],
    expectedReviewFlags: ["reference_document_only"],
    expectedAssistantRelevance: "supporting_doc_reference",
    mapsToGoldenScenarioIds: [],
  },
  C041: {
    familyBucket: "service_or_aml_or_supporting_doc",
    expectedSensitivity: "high_sensitivity",
    expectedClientBindingType: "none",
    expectedEntities: ["company", "taxAuthority"],
    expectedExtractedFields: ["taxPeriod", "companyName"],
    expectedForbiddenActions: ["publish_as_insurance_contract", "auto_publish"],
    expectedReviewFlags: ["reference_document_only"],
    expectedAssistantRelevance: "supporting_doc_reference",
    mapsToGoldenScenarioIds: [],
  },
};

let fixed = 0;
for (const doc of manifest.corpusDocuments) {
  const fix = FIXES[doc.id];
  if (!fix) continue;
  Object.assign(doc, fix);
  // Ensure expectedActionsForbidden mirrors expectedForbiddenActions
  doc.expectedActionsForbidden = [...doc.expectedForbiddenActions];
  fixed++;
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`✅ Fixed ${fixed} corpus docs with correct legacy fields and valid enum values.`);
