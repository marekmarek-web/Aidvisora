import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const EXPECTED_CORPUS_COUNT = 41;

/** Repo root when vitest cwd is apps/web */
function manifestPath(): string {
  return path.join(process.cwd(), "..", "..", "fixtures", "golden-ai-review", "scenarios.manifest.json");
}

const ALLOWED_FAMILY_BUCKETS = new Set([
  "final_life_contract",
  "life_proposal",
  "life_modelation",
  "life_bundle_with_questionnaires",
  "investment_or_dip_or_dps",
  "consumer_loan",
  "mortgage_or_mortgage_proposal",
  "leasing",
  "service_or_aml_or_supporting_doc",
  "non_publishable_attachment_only",
  // Phase 3 additions
  "non_life_insurance",
  "compliance",
]);

const ALLOWED_EXPECTED_FAMILIES = new Set([
  "life_insurance",
  "investment",
  "consumer_credit",
  "mortgage",
  "leasing",
  "compliance",
  // Phase 3 additions
  "non_life_insurance",
]);

const ALLOWED_OUTPUT_MODES = new Set([
  "structured_product_document",
  "signature_ready_proposal",
  "modelation_or_precontract",
  "reference_or_supporting_document",
]);

const ALLOWED_SENSITIVITY = new Set(["standard", "high_sensitivity", "mixed_sensitive", "financial_data"]);

type FallbackBehavior = {
  expectedSummaryFocus: string;
  expectedPurposeHint: string;
  recommendedNextStep: string;
  noProductPublishPayload: boolean;
};

type CorpusDoc = {
  id: string;
  familyBucket: string;
  referenceFile: string;
  gitTracked: boolean;
  expectedPrimaryType: string;
  publishable: boolean | string;
  isPacket: boolean;
  expectedEntities: string[];
  expectedExtractedFields: string[];
  expectedForbiddenActions: string[];
  expectedReviewFlags: string[];
  expectedAssistantRelevance: string;
  mapsToGoldenScenarioIds: string[];
  corpusNote?: string;
  aliasFileNames?: string[];
  expectedFamily: string;
  expectedPublishability: boolean | string;
  expectedOutputMode: string;
  expectedSensitivity: string;
  expectedClientBindingType: string;
  expectedCoreFields: string[];
  expectedActionsAllowed: string[];
  expectedActionsForbidden: string[];
  expectedNotesForAdvisor: string;
  expectedFallbackBehavior?: FallbackBehavior;
};

type ScenarioRow = { id: string; coversCorpusIds?: string[] };

type Manifest = {
  version: number;
  scenarios: ScenarioRow[];
  corpusDocuments: CorpusDoc[];
};

function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

describe("golden-dataset manifest (phase 1–3, corpus v4)", () => {
  it("parses v4 with 12 scenarios and full corpusDocuments", () => {
    const p = manifestPath();
    expect(existsSync(p)).toBe(true);
    const raw = JSON.parse(readFileSync(p, "utf8")) as Manifest;
    expect(raw.version).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(raw.scenarios)).toBe(true);
    expect(raw.scenarios.length).toBe(12);
    expect(Array.isArray(raw.corpusDocuments)).toBe(true);
    expect(raw.corpusDocuments.length).toBe(EXPECTED_CORPUS_COUNT);
  });

  it("every corpus document has required fields and valid familyBucket", () => {
    const p = manifestPath();
    const raw = JSON.parse(readFileSync(p, "utf8")) as Manifest;
    const scenarioCovers = new Map<string, string[]>();
    for (const s of raw.scenarios) {
      scenarioCovers.set(s.id, s.coversCorpusIds ?? []);
    }

    const seen = new Set<string>();
    for (const d of raw.corpusDocuments) {
      expect(d.id).toMatch(/^C\d{2,3}$/);
      expect(seen.has(d.id)).toBe(false);
      seen.add(d.id);
      expect(ALLOWED_FAMILY_BUCKETS.has(d.familyBucket)).toBe(true);
      expect(typeof d.referenceFile).toBe("string");
      expect(d.referenceFile.startsWith("Test AI/")).toBe(true);
      expect(typeof d.gitTracked).toBe("boolean");
      expect(typeof d.expectedPrimaryType).toBe("string");
      expect(d.expectedPrimaryType.length).toBeGreaterThan(0);
      expect(["boolean", "string"].includes(typeof d.publishable)).toBe(true);
      expect(typeof d.isPacket).toBe("boolean");
      // Legacy fields (C001-C029) — present on older entries, optional on Phase 3 additions
      if (d.expectedEntities !== undefined) {
        expect(Array.isArray(d.expectedEntities)).toBe(true);
        expect(d.expectedEntities.length).toBeGreaterThan(0);
      }
      if (d.expectedExtractedFields !== undefined) {
        expect(Array.isArray(d.expectedExtractedFields)).toBe(true);
        expect(d.expectedExtractedFields.length).toBeGreaterThan(0);
      }
      if (d.expectedForbiddenActions !== undefined) {
        expect(Array.isArray(d.expectedForbiddenActions)).toBe(true);
      }
      if (d.expectedReviewFlags !== undefined) {
        expect(Array.isArray(d.expectedReviewFlags)).toBe(true);
      }
      if (d.expectedAssistantRelevance !== undefined) {
        expect(typeof d.expectedAssistantRelevance).toBe("string");
        expect(d.expectedAssistantRelevance.length).toBeGreaterThan(0);
      }
      if (d.mapsToGoldenScenarioIds !== undefined) {
        expect(Array.isArray(d.mapsToGoldenScenarioIds)).toBe(true);
        for (const g of d.mapsToGoldenScenarioIds) {
          expect(g).toMatch(/^G\d{2}$/);
          const covers = scenarioCovers.get(g) ?? [];
          expect(
            covers.includes(d.id),
            `corpus ${d.id} lists ${g} but scenario does not cover this id`,
          ).toBe(true);
        }
      }
      if (d.aliasFileNames) {
        expect(Array.isArray(d.aliasFileNames)).toBe(true);
        for (const a of d.aliasFileNames) {
          expect(a.startsWith("Test AI/")).toBe(true);
        }
      }

      expect(typeof d.expectedFamily).toBe("string");
      expect(ALLOWED_EXPECTED_FAMILIES.has(d.expectedFamily)).toBe(true);
      expect(d.expectedPublishability).toEqual(d.publishable);
      expect(ALLOWED_OUTPUT_MODES.has(d.expectedOutputMode)).toBe(true);
      expect(ALLOWED_SENSITIVITY.has(d.expectedSensitivity)).toBe(true);
      expect(typeof d.expectedClientBindingType).toBe("string");
      expect(d.expectedClientBindingType.length).toBeGreaterThan(0);
      expect(Array.isArray(d.expectedCoreFields)).toBe(true);
      expect(d.expectedCoreFields.length).toBeGreaterThan(0);
      expect(Array.isArray(d.expectedActionsAllowed)).toBe(true);
      expect(d.expectedActionsAllowed.length).toBeGreaterThan(0);
      expect(Array.isArray(d.expectedActionsForbidden)).toBe(true);
      // expectedForbiddenActions must mirror expectedActionsForbidden when both are present
      if (d.expectedForbiddenActions !== undefined) {
        expect(sameStringArray(d.expectedActionsForbidden, d.expectedForbiddenActions)).toBe(true);
      }
      expect(typeof d.expectedNotesForAdvisor).toBe("string");

      if (d.expectedOutputMode === "reference_or_supporting_document") {
        const fb = d.expectedFallbackBehavior;
        expect(fb, `reference doc ${d.id} must define expectedFallbackBehavior`).toBeDefined();
        expect(typeof fb!.expectedSummaryFocus).toBe("string");
        expect(fb!.expectedSummaryFocus.length).toBeGreaterThan(0);
        expect(typeof fb!.expectedPurposeHint).toBe("string");
        expect(fb!.expectedPurposeHint.length).toBeGreaterThan(0);
        expect(typeof fb!.recommendedNextStep).toBe("string");
        expect(fb!.recommendedNextStep.length).toBeGreaterThan(0);
        expect(fb!.noProductPublishPayload).toBe(true);
      } else {
        expect(d.expectedFallbackBehavior).toBeUndefined();
      }
    }
    expect(seen.size).toBe(EXPECTED_CORPUS_COUNT);
  });


  it("G02 covers only modelation-aligned corpus ids (not liability proposal)", () => {
    const raw = JSON.parse(readFileSync(manifestPath(), "utf8")) as Manifest;
    const g02 = raw.scenarios.find((s) => s.id === "G02");
    expect(g02?.coversCorpusIds).toEqual(["C003", "C007", "C013"]);
  });
});
