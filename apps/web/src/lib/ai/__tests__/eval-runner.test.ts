import { describe, expect, it } from "vitest";
import { compareDocumentResult, runEvalBatch } from "../eval-runner";
import { compareEvalRuns } from "../eval-version-comparison";
import type { EvalDatasetEntry, EvalDataset, EvalRunMetrics } from "../eval-types";

const entry: EvalDatasetEntry = {
  id: "e1",
  documentName: "insurance_contract/allianz-01.pdf",
  documentCategory: "life_insurance_final_contract",
  inputMode: "text_pdf",
  storagePath: "/fixtures/allianz-01.pdf",
  expectedClassification: {
    primaryType: "life_insurance_final_contract",
    lifecycleStatus: "final_contract",
    isFinalContract: true,
    isProposalOnly: false,
    containsPaymentInstructions: false,
  },
  expectedFields: {
    contractNumber: { value: "123456", required: true },
    institutionName: { value: "Allianz", required: true },
    clientFullName: { value: "Jan Novák", required: true },
  },
  anonymized: false,
  createdAt: "2026-01-01",
};

describe("compareDocumentResult", () => {
  it("marks correct classification and fields", () => {
    const result = compareDocumentResult(
      entry,
      { contractNumber: "123456", institutionName: "Allianz", clientFullName: "Jan Novák" },
      {
        classifiedType: "life_insurance_final_contract",
        lifecycleStatus: "final_contract",
      },
    );
    expect(result.classificationCorrect).toBe(true);
    expect(result.lifecycleCorrect).toBe(true);
    expect(result.fieldAccuracy).toBe(1);
    expect(result.completeness).toBe(1);
  });

  it("detects wrong classification", () => {
    const result = compareDocumentResult(
      entry,
      { contractNumber: "123456" },
      { classifiedType: "insurance_proposal" },
    );
    expect(result.classificationCorrect).toBe(false);
  });

  it("detects missing fields", () => {
    const result = compareDocumentResult(entry, { contractNumber: "WRONG" });
    expect(result.fieldAccuracy).toBeLessThan(1);
    expect(result.completeness).toBeLessThan(1);
  });
});

describe("runEvalBatch", () => {
  it("aggregates metrics across entries", () => {
    const dataset: EvalDataset = {
      version: "1.0",
      entries: [entry],
      createdAt: "2026-01-01",
      description: "test",
    };
    const payloads = new Map([
      ["e1", { contractNumber: "123456", institutionName: "Allianz", clientFullName: "Jan Novák" }],
    ]);
    const metaMap = new Map([
      ["e1", { classifiedType: "life_insurance_final_contract", lifecycleStatus: "final_contract" } as const],
    ]);
    const result = runEvalBatch(dataset, payloads, metaMap);
    expect(result.totalDocuments).toBe(1);
    expect(result.documentClassificationAccuracy).toBe(1);
    expect(result.fieldLevelAccuracy).toBe(1);
    expect(result.datasetVersion).toBe("1.0");
    expect(result.documentResults.length).toBe(1);
  });

  it("fills perTypeMetrics", () => {
    const dataset: EvalDataset = {
      version: "1.0",
      entries: [entry],
      createdAt: "2026-01-01",
      description: "test",
    };
    const payloads = new Map([
      ["e1", { contractNumber: "123456", institutionName: "Allianz", clientFullName: "Jan Novák" }],
    ]);
    const metaMap = new Map([
      ["e1", { classifiedType: "life_insurance_final_contract", lifecycleStatus: "final_contract" } as const],
    ]);
    const result = runEvalBatch(dataset, payloads, metaMap);
    expect(Object.keys(result.perTypeMetrics).length).toBeGreaterThan(0);
  });
});

describe("compareEvalRuns", () => {
  function makeRun(overrides: Partial<EvalRunMetrics>): EvalRunMetrics {
    return {
      runId: "r1",
      datasetVersion: "1.0",
      runAt: "2026-01-01",
      totalDocuments: 10,
      documentClassificationAccuracy: 0.9,
      contractExtractionCompleteness: 0.85,
      fieldLevelAccuracy: 0.88,
      paymentInstructionExtractionAccuracy: 0.95,
      clientMatchingAccuracy: 0.92,
      reviewRate: 0.2,
      falsePositiveApplyRate: 0.02,
      perTypeMetrics: {},
      documentResults: [],
      ...overrides,
    };
  }

  it("passes when metrics are stable", () => {
    const result = compareEvalRuns(makeRun({}), makeRun({}));
    expect(result.pass).toBe(true);
    expect(result.regressions).toEqual([]);
  });

  it("detects regression in classification accuracy", () => {
    const result = compareEvalRuns(
      makeRun({ documentClassificationAccuracy: 0.9 }),
      makeRun({ documentClassificationAccuracy: 0.85 }),
    );
    expect(result.pass).toBe(false);
    expect(result.regressions).toContain("documentClassificationAccuracy");
  });

  it("detects regression in payment accuracy", () => {
    const result = compareEvalRuns(
      makeRun({ paymentInstructionExtractionAccuracy: 0.95 }),
      makeRun({ paymentInstructionExtractionAccuracy: 0.93 }),
    );
    expect(result.pass).toBe(false);
    expect(result.regressions).toContain("paymentInstructionExtractionAccuracy");
  });

  it("detects regression when review rate increases too much", () => {
    const result = compareEvalRuns(
      makeRun({ reviewRate: 0.1 }),
      makeRun({ reviewRate: 0.2 }),
    );
    expect(result.pass).toBe(false);
    expect(result.regressions).toContain("reviewRate");
  });

  it("reports improvements", () => {
    const result = compareEvalRuns(
      makeRun({ fieldLevelAccuracy: 0.8 }),
      makeRun({ fieldLevelAccuracy: 0.9 }),
    );
    expect(result.improvements).toContain("fieldLevelAccuracy");
  });
});
