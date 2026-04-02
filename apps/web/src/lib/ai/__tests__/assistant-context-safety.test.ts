/**
 * Phase 2B: unit tests for context safety guards.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/audit", () => ({ logAuditAction: vi.fn() }));

import { verifyWriteContextSafety, hasActiveLock } from "../assistant-context-safety";
import { getOrCreateSession, lockAssistantClient } from "../assistant-session";
import type { EntityResolutionResult } from "../assistant-entity-resolution";
import type { ExecutionPlan } from "../assistant-domain-model";

const TENANT = "t-1";
const USER = "u-1";
const CLIENT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CLIENT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makePlan(contactId: string | null, hasWriteSteps = true): ExecutionPlan {
  return {
    planId: "plan_test",
    intentType: "create_task",
    productDomain: null,
    contactId,
    opportunityId: null,
    steps: hasWriteSteps ? [{
      stepId: "s1",
      action: "createTask",
      params: { contactId },
      label: "Vytvořit úkol",
      requiresConfirmation: true,
      isReadOnly: false,
      dependsOn: [],
      status: "requires_confirmation",
      result: null,
    }] : [],
    status: "awaiting_confirmation",
    createdAt: new Date(),
  };
}

function makeResolution(clientId?: string, ambiguous = false, confidence = 1.0): EntityResolutionResult {
  return {
    client: clientId ? {
      entityType: "contact",
      entityId: clientId,
      displayLabel: "Test",
      confidence,
      ambiguous,
      alternatives: ambiguous ? [{ id: "alt-1", label: "Alt klient" }] : [],
    } : null,
    opportunity: null,
    document: null,
    contract: null,
    warnings: [],
  };
}

describe("verifyWriteContextSafety", () => {
  it("is safe when client matches locked context", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    lockAssistantClient(session, CLIENT_A);
    const verdict = verifyWriteContextSafety(session, makeResolution(CLIENT_A), makePlan(CLIENT_A));
    expect(verdict.safe).toBe(true);
    expect(verdict.blockedReason).toBeNull();
  });

  it("blocks when no client is resolved for write plan", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    const verdict = verifyWriteContextSafety(session, makeResolution(), makePlan(null));
    expect(verdict.safe).toBe(false);
    expect(verdict.blockedReason).toBe("NO_CLIENT_FOR_WRITE");
  });

  it("blocks when client is ambiguous", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    const verdict = verifyWriteContextSafety(session, makeResolution(CLIENT_A, true), makePlan(CLIENT_A));
    expect(verdict.safe).toBe(false);
    expect(verdict.blockedReason).toBe("AMBIGUOUS_CLIENT");
  });

  it("requires confirmation for cross-client mismatch", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    lockAssistantClient(session, CLIENT_A);
    const verdict = verifyWriteContextSafety(session, makeResolution(CLIENT_B), makePlan(CLIENT_B));
    expect(verdict.safe).toBe(true);
    expect(verdict.requiresConfirmation).toBe(true);
    expect(verdict.warnings.some(w => w.includes("jiný klient"))).toBe(true);
  });

  it("requires confirmation for low-confidence client", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    const verdict = verifyWriteContextSafety(session, makeResolution(CLIENT_A, false, 0.4), makePlan(CLIENT_A));
    expect(verdict.safe).toBe(true);
    expect(verdict.requiresConfirmation).toBe(true);
  });

  it("blocks when plan contactId mismatches resolved client", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    const verdict = verifyWriteContextSafety(session, makeResolution(CLIENT_A), makePlan(CLIENT_B));
    expect(verdict.safe).toBe(false);
    expect(verdict.blockedReason).toBe("PLAN_CLIENT_MISMATCH");
  });
});

describe("hasActiveLock", () => {
  it("returns true for locked client", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    lockAssistantClient(session, CLIENT_A);
    expect(hasActiveLock(session, "client", CLIENT_A)).toBe(true);
    expect(hasActiveLock(session, "client", CLIENT_B)).toBe(false);
  });
});
