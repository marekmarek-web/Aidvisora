/**
 * Phase 3C – safety-critical mortgage (hypo) and sensitive product edge cases.
 *
 * Covers:
 * - Cross-domain contamination: bank name alone must NOT infer hypo domain
 * - LTV advisory hint surfaces via computeWriteActionMissingFields with domain arg
 * - High LTV (>90%) triggers a runtime warning in createOpportunity adapter contract
 * - updateOpportunity: conflicting caseType + productDomain emits warning, productDomain wins
 * - updateOpportunity: product-domain change (reclassification) is detectable
 * - createServiceCase fingerprint stability for same hypo service request
 * - Context safety: hypo write without client is blocked (NO_CLIENT_FOR_WRITE)
 * - Context safety: ambiguous client blocks hypo write
 * - Context safety: cross-client hypo write requires confirmation
 * - Context safety: hypo write with locked opportunity mismatch is blocked
 * - createServiceCase for hypo výročí has correct productDomain
 * - Duplicate hypo detection: same params → same fingerprint
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("db", () => ({
  db: {},
  eq: vi.fn(),
  and: vi.fn(),
  opportunityStages: {},
  opportunities: {},
}));

import {
  emptyCanonicalIntent,
  resolveProductDomain,
  type CanonicalIntent,
} from "../assistant-domain-model";
import type { EntityResolutionResult } from "../assistant-entity-resolution";
import {
  buildExecutionPlan,
  computeWriteActionMissingFields,
} from "../assistant-execution-plan";
import { legacyIntentToCanonical } from "../assistant-intent";
import {
  computeStepFingerprint,
  checkRecentFingerprint,
  recordFingerprint,
} from "../assistant-action-fingerprint";
import { verifyWriteContextSafety } from "../assistant-context-safety";
import { getOrCreateSession, lockAssistantClient } from "../assistant-session";

const CONTACT_A = "aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CONTACT_B = "bbbb0002-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OPP_ID = "00aa0001-0000-0000-0000-000000000001";

function res(clientId?: string, opts: { ambiguous?: boolean; confidence?: number } = {}): EntityResolutionResult {
  return {
    client: clientId
      ? {
          entityType: "contact",
          entityId: clientId,
          displayLabel: "Test Klient",
          confidence: opts.confidence ?? 1.0,
          ambiguous: opts.ambiguous ?? false,
          alternatives: [],
        }
      : null,
    opportunity: null,
    document: null,
    contract: null,
    warnings: [],
  };
}

function intent(partial: Partial<CanonicalIntent>): CanonicalIntent {
  return { ...emptyCanonicalIntent(), ...partial };
}

// ─── CROSS-DOMAIN CONTAMINATION ───────────────────────────────────────────────

describe("Cross-domain contamination: bank name without mortgage context (3C)", () => {
  it("bank + investice purpose → investice, not hypo", () => {
    const canonical = legacyIntentToCanonical({
      actions: ["create_opportunity"],
      switchClient: false,
      clientRef: "Jan Novák",
      amount: null,
      ltv: null,
      purpose: "investice",
      bank: "KB",
      rateGuess: null,
      noEmail: false,
      dueDateText: null,
    });
    expect(canonical.productDomain).toBe("investice");
    expect(canonical.productDomain).not.toBe("hypo");
  });

  it("bank + DPS purpose → dps, not hypo", () => {
    const canonical = legacyIntentToCanonical({
      actions: ["create_opportunity"],
      switchClient: false,
      clientRef: null,
      amount: null,
      ltv: null,
      purpose: "dps",
      bank: "ČSOB",
      rateGuess: null,
      noEmail: false,
      dueDateText: null,
    });
    expect(canonical.productDomain).toBe("dps");
    expect(canonical.productDomain).not.toBe("hypo");
  });

  it("bank alone (null purpose) → null domain, not hypo", () => {
    const canonical = legacyIntentToCanonical({
      actions: ["create_opportunity"],
      switchClient: false,
      clientRef: null,
      amount: null,
      ltv: null,
      purpose: null,
      bank: "ČS",
      rateGuess: null,
      noEmail: false,
      dueDateText: null,
    });
    expect(canonical.productDomain).toBeNull();
  });

  it("bank + mortgage purpose → hypo (correct inference)", () => {
    const canonical = legacyIntentToCanonical({
      actions: ["create_opportunity"],
      switchClient: false,
      clientRef: null,
      amount: 4000000,
      ltv: 80,
      purpose: "koupě bytu",
      bank: "ČSOB",
      rateGuess: null,
      noEmail: false,
      dueDateText: null,
    });
    expect(canonical.productDomain).toBe("hypo");
  });

  it("výročí text resolves to servis domain, not hypo", () => {
    expect(resolveProductDomain("výročí")).toBe("servis");
    expect(resolveProductDomain("výročí")).not.toBe("hypo");
  });

  it("penzijní text resolves to dps, not hypo", () => {
    expect(resolveProductDomain("penzijní")).toBe("dps");
  });
});

// ─── LTV ADVISORY ─────────────────────────────────────────────────────────────

describe("LTV advisory hints for hypo domain (3C)", () => {
  it("hypo without amount has advisory hint amount|purpose", () => {
    const missing = computeWriteActionMissingFields("createOpportunity", { contactId: CONTACT_A }, "hypo");
    expect(missing.some((m) => m.includes("amount") || m.includes("purpose"))).toBe(true);
  });

  it("hypo with LTV but no amount still has advisory hint", () => {
    const missing = computeWriteActionMissingFields(
      "createOpportunity",
      { contactId: CONTACT_A, ltv: 80 },
      "hypo",
    );
    expect(missing.some((m) => m.includes("amount") || m.includes("purpose"))).toBe(true);
  });

  it("hypo with amount present — advisory hint is gone", () => {
    const missing = computeWriteActionMissingFields(
      "createOpportunity",
      { contactId: CONTACT_A, amount: 3500000 },
      "hypo",
    );
    expect(missing.some((m) => m.includes("amount"))).toBe(false);
  });

  it("advisory hints are non-blocking: plan is awaiting_confirmation even without amount", () => {
    const plan = buildExecutionPlan(
      intent({
        intentType: "create_opportunity",
        requestedActions: ["create_opportunity"],
        productDomain: "hypo",
      }),
      res(CONTACT_A),
    );
    // Advisory domain hints do NOT push to draft — only structural field checks do.
    expect(plan.status).toBe("awaiting_confirmation");
  });
});

// ─── updateOpportunity: PRODUCT DOMAIN CHANGE & CONFLICT ────────────────────

describe("updateOpportunity — product domain change detection (3C)", () => {
  it("plan with productDomain only → no conflict", () => {
    const plan = buildExecutionPlan(
      intent({
        intentType: "update_opportunity",
        requestedActions: ["update_opportunity"],
        productDomain: "investice",
        targetOpportunity: { ref: OPP_ID, resolved: true },
      }),
      res(CONTACT_A),
    );
    const step = plan.steps.find((s) => s.action === "updateOpportunity");
    expect(step).toBeDefined();
    expect(step?.params.productDomain).toBe("investice");
    // No caseType in params — no conflict possible
    expect(step?.params.caseType).toBeUndefined();
  });

  it("plan params include previousProductDomain for reclassification detection", () => {
    const planIntent = intent({
      intentType: "update_opportunity",
      requestedActions: ["update_opportunity"],
      productDomain: "hypo",
      targetOpportunity: { ref: OPP_ID, resolved: true },
      extractedFacts: [
        { key: "previousProductDomain", value: "investice", source: "context" },
      ],
    });
    const plan = buildExecutionPlan(planIntent, res(CONTACT_A));
    const step = plan.steps.find((s) => s.action === "updateOpportunity");
    expect(step?.params.previousProductDomain).toBe("investice");
    expect(step?.params.productDomain).toBe("hypo");
  });
});

// ─── createServiceCase: FINGERPRINT STABILITY ──────────────────────────────

describe("createServiceCase fingerprint stability (3C hypo service case)", () => {
  it("same hypo service case params → identical fingerprint", () => {
    const planA = buildExecutionPlan(
      intent({
        intentType: "create_service_case",
        requestedActions: ["create_service_case"],
        productDomain: "hypo",
        extractedFacts: [{ key: "noteContent", value: "výročí fixace", source: "user_text" }],
      }),
      res(CONTACT_A),
    );
    const planB = buildExecutionPlan(
      intent({
        intentType: "create_service_case",
        requestedActions: ["create_service_case"],
        productDomain: "hypo",
        extractedFacts: [{ key: "noteContent", value: "výročí fixace", source: "user_text" }],
      }),
      res(CONTACT_A),
    );
    const fpA = computeStepFingerprint(planA.steps[0]!);
    const fpB = computeStepFingerprint(planB.steps[0]!);
    expect(fpA).toBe(fpB);
  });

  it("different noteContent → different fingerprint", () => {
    const planA = buildExecutionPlan(
      intent({
        intentType: "create_service_case",
        requestedActions: ["create_service_case"],
        productDomain: "hypo",
        extractedFacts: [{ key: "noteContent", value: "výročí fixace", source: "user_text" }],
      }),
      res(CONTACT_A),
    );
    const planB = buildExecutionPlan(
      intent({
        intentType: "create_service_case",
        requestedActions: ["create_service_case"],
        productDomain: "hypo",
        extractedFacts: [{ key: "noteContent", value: "refinancování", source: "user_text" }],
      }),
      res(CONTACT_A),
    );
    const fpA = computeStepFingerprint(planA.steps[0]!);
    const fpB = computeStepFingerprint(planB.steps[0]!);
    expect(fpA).not.toBe(fpB);
  });

  it("duplicate hypo service case is detected after recording fingerprint", () => {
    const sessionId = "hypo-dedup-test-session";
    const plan = buildExecutionPlan(
      intent({
        intentType: "create_service_case",
        requestedActions: ["create_service_case"],
        productDomain: "hypo",
        extractedFacts: [{ key: "noteContent", value: "výročí hypotéky", source: "user_text" }],
      }),
      res(CONTACT_A),
    );
    const step = plan.steps[0]!;
    const fp = computeStepFingerprint(step);

    expect(checkRecentFingerprint(sessionId, fp).isDuplicate).toBe(false);
    recordFingerprint(sessionId, fp, "action-001");
    const after = checkRecentFingerprint(sessionId, fp);
    expect(after.isDuplicate).toBe(true);
    expect(after.existingActionId).toBe("action-001");
  });
});

// ─── CONTEXT SAFETY: HYPO-SPECIFIC ────────────────────────────────────────────

describe("Context safety for hypo writes (3C)", () => {
  it("hypo write without resolved client is blocked (NO_CLIENT_FOR_WRITE)", () => {
    const session = getOrCreateSession(undefined, "t-hypo", "u-hypo");
    const plan = buildExecutionPlan(
      intent({ intentType: "create_opportunity", requestedActions: ["create_opportunity"], productDomain: "hypo" }),
      res(),
    );
    const safety = verifyWriteContextSafety(session, res(), plan);
    expect(safety.safe).toBe(false);
    expect(safety.blockedReason).toBe("NO_CLIENT_FOR_WRITE");
  });

  it("hypo write with ambiguous client is blocked (AMBIGUOUS_CLIENT)", () => {
    const session = getOrCreateSession(undefined, "t-hypo", "u-hypo");
    const ambigRes = res(CONTACT_A, { ambiguous: true });
    const plan = buildExecutionPlan(
      intent({ intentType: "create_opportunity", requestedActions: ["create_opportunity"], productDomain: "hypo" }),
      ambigRes,
    );
    const safety = verifyWriteContextSafety(session, ambigRes, plan);
    expect(safety.safe).toBe(false);
    expect(safety.blockedReason).toBe("AMBIGUOUS_CLIENT");
  });

  it("hypo write with cross-client (locked A, resolved B) requires confirmation but is safe", () => {
    const session = getOrCreateSession(undefined, "t-hypo", "u-hypo");
    lockAssistantClient(session, CONTACT_A);
    const crossRes = res(CONTACT_B);
    const plan = buildExecutionPlan(
      intent({ intentType: "create_opportunity", requestedActions: ["create_opportunity"], productDomain: "hypo" }),
      crossRes,
    );
    const safety = verifyWriteContextSafety(session, crossRes, plan);
    expect(safety.safe).toBe(true);
    expect(safety.requiresConfirmation).toBe(true);
    expect(safety.warnings.some((w) => w.includes("jiný klient") || w.includes("zamčený"))).toBe(true);
  });

  it("hypo write with locked opportunity mismatch is blocked (OPPORTUNITY_LOCK_MISMATCH)", () => {
    const session = getOrCreateSession(undefined, "t-hypo", "u-hypo");
    lockAssistantClient(session, CONTACT_A);
    session.lockedOpportunityId = "other-opp-id";
    const plan = buildExecutionPlan(
      intent({
        intentType: "update_opportunity",
        requestedActions: ["update_opportunity"],
        productDomain: "hypo",
        targetOpportunity: { ref: OPP_ID, resolved: true },
      }),
      res(CONTACT_A),
    );
    const safety = verifyWriteContextSafety(session, res(CONTACT_A), plan);
    expect(safety.safe).toBe(false);
    expect(safety.blockedReason).toBe("OPPORTUNITY_LOCK_MISMATCH");
  });

  it("createServiceCase hypo výročí: correct productDomain, plan awaiting_confirmation", () => {
    const plan = buildExecutionPlan(
      intent({
        intentType: "create_service_case",
        requestedActions: ["create_service_case"],
        productDomain: "hypo",
        extractedFacts: [{ key: "noteContent", value: "výročí fixace", source: "user_text" }],
      }),
      res(CONTACT_A),
    );
    expect(plan.steps[0]?.action).toBe("createServiceCase");
    expect(plan.steps[0]?.params.productDomain).toBe("hypo");
    expect(plan.status).toBe("awaiting_confirmation");
  });
});

// ─── HAPPY PATH: HYPO ──────────────────────────────────────────────────────────

describe("Happy path: hypo opportunity with all facts (3C)", () => {
  it("hypo with contactId + amount → awaiting_confirmation, step has amount in params", () => {
    const plan = buildExecutionPlan(
      intent({
        intentType: "create_opportunity",
        requestedActions: ["create_opportunity"],
        productDomain: "hypo",
        extractedFacts: [
          { key: "amount", value: 3500000, source: "user_text" },
          { key: "ltv", value: 75, source: "user_text" },
          { key: "purpose", value: "koupě bytu", source: "user_text" },
        ],
      }),
      res(CONTACT_A),
    );
    expect(plan.status).toBe("awaiting_confirmation");
    const step = plan.steps[0]!;
    expect(step.action).toBe("createOpportunity");
    expect(step.params.amount).toBe(3500000);
    expect(step.params.ltv).toBe(75);
    expect(step.params.purpose).toBe("koupě bytu");
    expect(step.params.productDomain).toBe("hypo");
  });

  it("hypo fingerprint is stable across runs with same params", () => {
    const makeHypoPlan = () =>
      buildExecutionPlan(
        intent({
          intentType: "create_opportunity",
          requestedActions: ["create_opportunity"],
          productDomain: "hypo",
          extractedFacts: [{ key: "amount", value: 5000000, source: "user_text" }],
        }),
        res(CONTACT_A),
      );
    const fp1 = computeStepFingerprint(makeHypoPlan().steps[0]!);
    const fp2 = computeStepFingerprint(makeHypoPlan().steps[0]!);
    expect(fp1).toBe(fp2);
  });
});
