/**
 * P3: integration-style checks for post-upload review plan and contract/coverage planner steps (no DB).
 */
import { describe, it, expect } from "vitest";
import { emptyCanonicalIntent } from "../assistant-domain-model";
import type { EntityResolutionResult } from "../assistant-entity-resolution";
import { buildExecutionPlan, buildPostUploadReviewPlan } from "../assistant-execution-plan";

const CONTACT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REVIEW = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function resolution(): EntityResolutionResult {
  return {
    client: {
      entityType: "contact",
      entityId: CONTACT,
      displayLabel: "Jan Test",
      confidence: 1,
      ambiguous: false,
      alternatives: [],
    },
    opportunity: null,
    document: null,
    contract: null,
    warnings: [],
  };
}

describe("P3 buildPostUploadReviewPlan", () => {
  it("includes reviewId on approve, apply, and link steps", () => {
    const plan = buildPostUploadReviewPlan({ tenantId: "t1" }, REVIEW);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.every((s) => s.params.reviewId === REVIEW)).toBe(true);
    expect(plan.steps.map((s) => s.action)).toEqual([
      "approveAiContractReview",
      "applyAiContractReviewToCrm",
      "linkAiContractReviewToDocuments",
    ]);
    expect(plan.status).toBe("awaiting_confirmation");
  });
});

describe("P3 buildExecutionPlan — create_contract & update_coverage", () => {
  it("create_contract produces createContract step with contactId and segment", () => {
    const plan = buildExecutionPlan(
      {
        ...emptyCanonicalIntent(),
        intentType: "create_contract",
        requestedActions: ["create_contract"],
        productDomain: "zivotni_pojisteni",
        partnerName: "Allianz",
        productName: "Život",
      },
      resolution(),
    );
    const step = plan.steps.find((s) => s.action === "createContract");
    expect(step).toBeDefined();
    expect(step?.params.contactId).toBe(CONTACT);
    expect(step?.params.segment).toBeTruthy();
  });

  it("update_coverage produces upsertContactCoverage with resolved itemKey", () => {
    const plan = buildExecutionPlan(
      {
        ...emptyCanonicalIntent(),
        intentType: "update_coverage",
        requestedActions: ["update_coverage"],
        extractedFacts: [
          { key: "coverageItemKey", value: "odp", source: "user_text" },
          { key: "coverageStatus", value: "hotovo", source: "user_text" },
        ],
      },
      resolution(),
    );
    const step = plan.steps.find((s) => s.action === "upsertContactCoverage");
    expect(step).toBeDefined();
    expect(step?.params.contactId).toBe(CONTACT);
    expect(typeof step?.params.itemKey).toBe("string");
    expect((step?.params.itemKey as string).length).toBeGreaterThan(0);
    expect(step?.params.status).toBe("done");
  });
});
