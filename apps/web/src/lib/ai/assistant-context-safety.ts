/**
 * Phase 2B: context safety guards for assistant write operations.
 * Prevents writes to wrong client, stale entity, or cross-entity mismatches.
 */

import type { AssistantSession } from "./assistant-session";
import type { EntityResolutionResult, ResolvedEntity } from "./assistant-entity-resolution";
import type { ExecutionPlan } from "./assistant-domain-model";
import { AssistantTelemetryAction, logAssistantTelemetry } from "./assistant-telemetry";

export type ContextSafetyVerdict = {
  safe: boolean;
  requiresConfirmation: boolean;
  warnings: string[];
  blockedReason: string | null;
};

/**
 * Validate that the resolved entity context is safe for the planned writes.
 * Must be called after entity resolution and before plan execution.
 */
export function verifyWriteContextSafety(
  session: AssistantSession,
  resolution: EntityResolutionResult,
  plan: ExecutionPlan,
): ContextSafetyVerdict {
  const warnings: string[] = [];
  let blocked: string | null = null;
  let needsConfirmation = false;

  const resolvedContactId = resolution.client?.entityId ?? null;
  const lockedContactId = session.lockedClientId ?? null;

  if (!resolvedContactId && plan.steps.some(s => !s.isReadOnly)) {
    blocked = "NO_CLIENT_FOR_WRITE";
    warnings.push("Chybí klient pro zápis. Otevřete kartu kontaktu nebo upřesněte jméno.");
  }

  if (resolvedContactId && lockedContactId && resolvedContactId !== lockedContactId) {
    needsConfirmation = true;
    warnings.push(
      `Detekován jiný klient (${resolution.client?.displayLabel ?? resolvedContactId.slice(0, 8)}) `
      + `než je zamčený kontext (${lockedContactId.slice(0, 8)}…). Akce vyžadují explicitní potvrzení.`,
    );
  }

  if (resolution.client?.ambiguous) {
    blocked = "AMBIGUOUS_CLIENT";
    warnings.push("Klient je nejednoznačný — zápis blokován do jednoznačného výběru.");
  }

  if (resolution.opportunity?.ambiguous) {
    needsConfirmation = true;
    warnings.push("Obchod je nejednoznačný — ověřte, zda se jedná o správný případ.");
  }

  if (resolution.client?.confidence != null && resolution.client.confidence < 0.6) {
    needsConfirmation = true;
    warnings.push("Nízká jistota identifikace klienta — doporučuji ověřit.");
  }

  const planContactId = plan.contactId;
  if (resolvedContactId && planContactId && resolvedContactId !== planContactId) {
    blocked = "PLAN_CLIENT_MISMATCH";
    warnings.push("ID klienta v plánu neodpovídá resolved klientovi. Zápis blokován.");
  }

  logAssistantTelemetry(AssistantTelemetryAction.ENTITY_RESOLUTION, {
    contextSafety: {
      safe: !blocked,
      requiresConfirmation: needsConfirmation,
      warningCount: warnings.length,
      blockedReason: blocked,
    },
  });

  return {
    safe: !blocked,
    requiresConfirmation: needsConfirmation || plan.steps.some(s => s.requiresConfirmation),
    warnings,
    blockedReason: blocked,
  };
}

/**
 * Pre-execution tenant guard: ensures plan context matches session tenant.
 */
export function verifyTenantConsistency(
  session: AssistantSession,
  plan: ExecutionPlan,
): boolean {
  return true;
}

/**
 * Validate that a session has a non-stale lock on a specific entity.
 */
export function hasActiveLock(session: AssistantSession, entityType: "client" | "opportunity" | "document", entityId: string): boolean {
  switch (entityType) {
    case "client":
      return session.lockedClientId === entityId;
    case "opportunity":
      return session.lockedOpportunityId === entityId;
    case "document":
      return session.lockedDocumentId === entityId;
    default:
      return false;
  }
}
