/**
 * P4: review detail context surfaces apply/readiness and recommended actions when row exists.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../dashboard-priority", () => ({
  computePriorityItems: vi.fn().mockResolvedValue([]),
  getTasksDueAndOverdue: vi.fn().mockResolvedValue({ tasksDueToday: [], overdueTasks: [] }),
  getClientsNeedingAttention: vi.fn().mockResolvedValue([]),
}));

const getById = vi.fn();

vi.mock("../review-queue-repository", () => ({
  getContractReviewById: (...args: unknown[]) => getById(...args),
  listContractReviews: vi.fn().mockResolvedValue([]),
}));

vi.mock("../quality-gates", () => ({
  evaluateApplyReadiness: () => ({
    readiness: "ready_for_apply",
    blockedReasons: [],
    applyBarrierReasons: [],
    warnings: [],
  }),
}));

vi.mock("../pipeline-review-insights", () => ({
  buildPipelineInsightsFromReviewRow: () => ({}),
}));

import { buildReviewDetailContext } from "../assistant-context-builder";

beforeEach(() => {
  getById.mockReset();
});

describe("P4 buildReviewDetailContext", () => {
  it("returns recommendedActions when review is pending and apply is ready", async () => {
    getById.mockResolvedValue({
      id: "rev-1",
      tenantId: "t1",
      fileName: "smlouva.pdf",
      storagePath: "path/x",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      processingStatus: "done",
      processingStage: null,
      errorMessage: null,
      extractedPayload: null,
      clientMatchCandidates: null,
      draftActions: null,
      confidence: 0.9,
      reasonsForReview: null,
      reviewStatus: "pending",
      uploadedBy: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
      appliedBy: null,
      appliedAt: null,
      matchedClientId: "c1",
      createNewClientConfirmed: null,
      applyResultPayload: null,
      reviewDecisionReason: null,
      inputMode: null,
      extractionMode: null,
      detectedDocumentType: "life_insurance_contract",
      detectedDocumentSubtype: null,
      lifecycleStatus: null,
      documentIntent: null,
      extractionTrace: null,
      validationWarnings: null,
      fieldConfidenceMap: null,
      classificationReasons: null,
      dataCompleteness: null,
      sensitivityProfile: null,
      sectionSensitivity: null,
      relationshipInference: null,
      originalExtractedPayload: null,
    });
    const payload = await buildReviewDetailContext("t1", "rev-1");
    expect(payload.warnings.length).toBe(0);
    expect(payload.recommendedActions.some((a) => /schválit|aplikovat/i.test(a))).toBe(true);
  });
});
