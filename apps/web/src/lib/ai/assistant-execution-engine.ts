/**
 * Unified execution engine: runs confirmed ExecutionPlan steps against
 * the execution_actions ledger with DB-backed idempotency and audit logging.
 */

import { randomUUID } from "crypto";
import { executionActions, eq, and } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import type {
  CanonicalIntentType,
  ExecutionPlan,
  ExecutionStep,
  ExecutionStepResult,
  ProductDomain,
  WriteActionType,
  VerifiedAssistantResult,
} from "./assistant-domain-model";
import { logAudit } from "../audit";
import { logAssistantEvent } from "./assistant-audit";
import { AssistantTelemetryAction, logAssistantTelemetry } from "./assistant-telemetry";
import { computeStepFingerprint, checkRecentFingerprint, recordFingerprint } from "./assistant-action-fingerprint";
import { sanitizeStepErrorForDisplay, mapErrorForAdvisor } from "./assistant-error-mapping";

export type ExecutionContext = {
  tenantId: string;
  userId: string;
  sessionId: string;
  roleName: string;
  ipAddress?: string;
};

/** Bump when changing write contract shape stored in execution_actions metadata / resultPayload. */
export const ASSISTANT_WRITE_CONTRACT_VERSION = 1;

/** Shown in assistant UI when ledger writes were skipped (no raw DB errors). */
export const ASSISTANT_LEDGER_DEGRADED_ADVISOR_WARNING =
  "Evidence operací v databázi není k dispozici — akce proběhly, ale bez zápisu do knihy (žádná idempotence v DB). Po nasazení migrace `execution_actions` bude záznam opět plně funkční. Kontaktujte správce, pokud hláška přetrvává.";

export type PlanLedgerContext = {
  planId: string;
  intentType: CanonicalIntentType;
  productDomain: ProductDomain | null;
};

type WriteAdapter = (
  params: Record<string, unknown>,
  ctx: ExecutionContext,
) => Promise<ExecutionStepResult>;

const writeAdapters = new Map<WriteActionType, WriteAdapter>();

export function registerWriteAdapter(action: WriteActionType, adapter: WriteAdapter): void {
  writeAdapters.set(action, adapter);
}

let executionActionsTableAvailable = true;

/** Reset ledger availability flag between Vitest cases (module singleton). */
export function resetExecutionActionsTableAvailabilityForTests(): void {
  executionActionsTableAvailable = true;
}

/** Runtime health check: returns false if the execution_actions table was detected missing. */
export function isExecutionLedgerAvailable(): boolean {
  return executionActionsTableAvailable;
}

function isRelationMissingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("relation") && err.message.includes("does not exist");
}

async function checkIdempotency(
  tenantId: string,
  actionType: string,
  sourceId: string,
  userId?: string,
): Promise<{ entityId: string; resultPayload: unknown } | null> {
  if (!executionActionsTableAvailable) return null;
  try {
    const rows = await withTenantContext({ tenantId, userId: userId ?? null }, async (tx) => {
      return await tx
        .select({
          id: executionActions.id,
          resultPayload: executionActions.resultPayload,
          status: executionActions.status,
        })
        .from(executionActions)
        .where(
          and(
            eq(executionActions.tenantId, tenantId),
            eq(executionActions.actionType, actionType),
            eq(executionActions.sourceId, sourceId),
            eq(executionActions.status, "completed"),
          ),
        )
        .limit(1);
    });

    if (rows[0]) {
      const payload = rows[0].resultPayload as Record<string, unknown> | null;
      return { entityId: (payload?.entityId as string) ?? rows[0].id, resultPayload: payload };
    }
    return null;
  } catch (err) {
    if (isRelationMissingError(err)) {
      console.error(
        "[execution-engine] execution_actions table missing — idempotency check skipped. " +
        "Run: packages/db/migrations/add_execution_actions.sql",
      );
      executionActionsTableAvailable = false;
      return null;
    }
    throw err;
  }
}

export type AssistantLedgerInsertRow = {
  id: string;
  tenantId: string;
  sourceType: "assistant";
  sourceId: string;
  actionType: WriteActionType;
  executionMode: "assistant_confirmed";
  status: "completed" | "failed";
  executedAt: Date;
  executedBy: string;
  riskLevel: "medium" | "low";
  metadata: Record<string, unknown>;
  resultPayload: Record<string, unknown>;
  failureCode: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Pure builder for `execution_actions` insert — tested without DB / adapters. */
export function buildAssistantLedgerInsertRow(
  step: ExecutionStep,
  ctx: ExecutionContext,
  result: ExecutionStepResult,
  idempotencyKey: string,
  ledger: { plan: PlanLedgerContext; fingerprint: string },
  now: Date = new Date(),
): AssistantLedgerInsertRow {
  const { plan, fingerprint } = ledger;
  return {
    id: idempotencyKey,
    tenantId: ctx.tenantId,
    sourceType: "assistant",
    // C2: sourceId must match the idempotency key so cross-plan retries of the
    // same business write hit the existing row. Previous value
    // `${sessionId}:${stepId}` was ephemeral.
    sourceId: idempotencyKey,
    actionType: step.action,
    executionMode: "assistant_confirmed",
    status: result.ok ? "completed" : "failed",
    executedAt: now,
    executedBy: ctx.userId,
    riskLevel: step.requiresConfirmation ? "medium" : "low",
    metadata: {
      stepId: step.stepId,
      params: step.params,
      sessionId: ctx.sessionId,
      planId: plan.planId,
      intentType: plan.intentType,
      productDomain: plan.productDomain,
      fingerprint,
      contractVersion: ASSISTANT_WRITE_CONTRACT_VERSION,
    },
    resultPayload: {
      ok: result.ok,
      outcome: result.outcome,
      entityId: result.entityId,
      entityType: result.entityType,
      warnings: result.warnings,
      error: result.error,
      fingerprint,
      contractVersion: ASSISTANT_WRITE_CONTRACT_VERSION,
    },
    failureCode: result.error ? "adapter_error" : null,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Maps a completed ledger row to the in-memory result for idempotent replay. */
export function idempotentHitResultFromLedgerPayload(
  existing: { entityId: string; resultPayload: unknown },
  stepAction: WriteActionType,
): ExecutionStepResult {
  const payload = existing.resultPayload as Record<string, unknown> | null;
  return {
    ok: true,
    outcome: "idempotent_hit",
    entityId: existing.entityId,
    entityType: (payload?.entityType as string) ?? stepAction,
    warnings: ["Akce již byla provedena (idempotentní)."],
    error: null,
  };
}

/**
 * Injects opportunityId from a succeeded createOpportunity predecessor (3D-2 multi_action).
 * Exported for unit tests.
 */
export function mergeWriteStepParamsFromCompletedDependencies(
  step: ExecutionStep,
  allSteps: ExecutionStep[],
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...step.params };
  for (const depId of step.dependsOn) {
    const dep = allSteps.find((s) => s.stepId === depId);
    if (!dep?.result?.ok || !dep.result.entityId) continue;
    if (dep.action === "createOpportunity") {
      if (dep.result.entityType && dep.result.entityType !== "opportunity") continue;
      const cur = merged.opportunityId;
      if (cur != null && cur !== "") continue;
      merged.opportunityId = dep.result.entityId;
      continue;
    }
    if (dep.action === "createContact") {
      if (dep.result.entityType && dep.result.entityType !== "contact") continue;
      const cur = merged.contactId;
      if (cur != null && cur !== "") continue;
      merged.contactId = dep.result.entityId;
    }
  }
  return merged;
}

async function recordExecution(
  step: ExecutionStep,
  ctx: ExecutionContext,
  result: ExecutionStepResult,
  idempotencyKey: string,
  ledger: { plan: PlanLedgerContext; fingerprint: string },
): Promise<void> {
  if (!executionActionsTableAvailable) return;
  try {
    const now = new Date();
    await withTenantContext({ tenantId: ctx.tenantId, userId: ctx.userId }, async (tx) => {
      await tx.insert(executionActions).values(buildAssistantLedgerInsertRow(step, ctx, result, idempotencyKey, ledger, now));
    });
  } catch (err) {
    if (isRelationMissingError(err)) {
      console.error(
        "[execution-engine] execution_actions table missing — ledger write skipped. " +
        "Run: packages/db/migrations/add_execution_actions.sql",
      );
      executionActionsTableAvailable = false;
      return;
    }
    throw err;
  }
}

async function executeStep(
  step: ExecutionStep,
  ctx: ExecutionContext,
  planLedger: PlanLedgerContext,
): Promise<ExecutionStepResult> {
  if (step.status !== "confirmed") {
    return { ok: false, outcome: "failed", entityId: null, entityType: null, warnings: [], error: "Krok nebyl potvrzen — nelze provést." };
  }

  const adapter = writeAdapters.get(step.action);
  if (!adapter) {
    return { ok: false, outcome: "failed", entityId: null, entityType: null, warnings: [], error: "Tato akce není momentálně dostupná." };
  }

  // C2: Idempotency key must be a stable function of (tenant, action, business payload),
  // not the ephemeral (sessionId, stepId). Re-plans produce fresh stepIds but the same
  // logical write — we want the ledger to recognize that and return the existing row.
  // Fingerprint already hashes (action, business-relevant params) per action type.
  const fingerprint = computeStepFingerprint(step);
  const idempotencyKey = `assistant:${ctx.tenantId}:${step.action}:${fingerprint}`;
  const existing = await checkIdempotency(ctx.tenantId, step.action, idempotencyKey, ctx.userId);
  if (existing) {
    logAssistantTelemetry(AssistantTelemetryAction.IDEMPOTENT_HIT, {
      stepId: step.stepId,
      action: step.action,
    });
    return idempotentHitResultFromLedgerPayload(existing, step.action);
  }

  const fpCheck = checkRecentFingerprint(ctx.sessionId, fingerprint);
  if (fpCheck.isDuplicate) {
    logAssistantTelemetry(AssistantTelemetryAction.DUPLICATE_DETECTED, {
      stepId: step.stepId,
      action: step.action,
      fingerprint,
      existingActionId: fpCheck.existingActionId,
    });
    // M5: the value stored in the in-memory fingerprint map can be either a real
    // row id or the previous step's idempotency key (when the adapter returned
    // no entityId). Returning a non-row id as `entityId` confuses the UI, which
    // then tries to deep-link into a non-existent record. Only propagate a value
    // that is clearly a row id (not a key we synthesized).
    const looksLikeIdempotencyKey = (v: string | null | undefined): boolean =>
      typeof v === "string" && v.startsWith("assistant:");
    const safeEntityId = looksLikeIdempotencyKey(fpCheck.existingActionId)
      ? null
      : fpCheck.existingActionId ?? null;
    return {
      ok: true,
      outcome: "duplicate_hit",
      entityId: safeEntityId,
      // M5: do not claim a typed entity when we don't actually have a row to
      // link to — `null` forces the UI to fall back to plain text.
      entityType: safeEntityId ? step.action : null,
      warnings: ["Duplicitní akce detekována — přeskočeno."],
      error: null,
    };
  }

  const ledgerSnapshot = { plan: planLedger, fingerprint };

  // H11: assign a stable per-step action id so every log line (tool_invoked /
  // action_applied / persistence failure) can be cross-correlated with the
  // ledger row and the Sentry capture.
  const assistantActionId = idempotencyKey;

  try {
    logAssistantEvent({
      eventType: "tool_invoked",
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      toolName: step.action,
      actionType: step.action,
      metadata: {
        assistantActionId,
        planId: planLedger.planId,
        intentType: planLedger.intentType,
        stepId: step.stepId,
      },
    });
    const adapterResult = await adapter(step.params, ctx);
    const result: ExecutionStepResult = {
      ...adapterResult,
      outcome: adapterResult.outcome ?? (adapterResult.ok ? "executed" : "failed"),
    };
    await recordExecution(step, ctx, result, idempotencyKey, ledgerSnapshot);

    if (result.ok) {
      recordFingerprint(ctx.sessionId, fingerprint, result.entityId ?? idempotencyKey);
      await logAudit({
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        action: `assistant.${step.action}`,
        entityType: result.entityType ?? step.action,
        entityId: result.entityId ?? undefined,
        meta: {
          stepId: step.stepId,
          sessionId: ctx.sessionId,
          planId: planLedger.planId,
          intentType: planLedger.intentType,
          fingerprint,
          assistantActionId,
          contractVersion: ASSISTANT_WRITE_CONTRACT_VERSION,
          params: step.params,
        },
        requestContext: ctx.ipAddress ? { ipAddress: ctx.ipAddress } : undefined,
      });
      logAssistantEvent({
        eventType: "action_applied",
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        toolName: step.action,
        actionType: step.action,
        entityType: result.entityType ?? step.action,
        entityId: result.entityId ?? undefined,
        metadata: {
          assistantActionId,
          planId: planLedger.planId,
          intentType: planLedger.intentType,
          stepId: step.stepId,
          outcome: result.outcome,
        },
      });
    }

    return result;
  } catch (err) {
    const rawError = err instanceof Error ? err.message : "Unknown execution error";
    const userError = mapErrorForAdvisor(rawError, step.action, `step ${step.stepId}`);
    const failResult: ExecutionStepResult = {
      ok: false,
      outcome: "failed",
      entityId: null,
      entityType: null,
      warnings: [],
      error: userError,
    };
    await recordExecution(step, ctx, failResult, idempotencyKey, ledgerSnapshot).catch(() => {});
    logAssistantEvent({
      eventType: "action_applied",
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      toolName: step.action,
      actionType: step.action,
      metadata: {
        assistantActionId,
        planId: planLedger.planId,
        intentType: planLedger.intentType,
        stepId: step.stepId,
        outcome: "failed",
        error: userError,
      },
    });
    return failResult;
  }
}

export type DependencyResolutionResult =
  | { ok: true; waves: ExecutionStep[][] }
  | { ok: false; reason: "cycle_or_unresolvable"; stuckStepIds: string[] };

export function resolveDependenciesSafe(steps: ExecutionStep[]): DependencyResolutionResult {
  const resolved = new Set<string>();
  const remaining = [...steps];
  const waves: ExecutionStep[][] = [];
  const stepIds = new Set(steps.map((s) => s.stepId));

  while (remaining.length > 0) {
    const wave = remaining.filter((s) =>
      s.dependsOn.every((dep) => resolved.has(dep) || !stepIds.has(dep)),
    );
    if (wave.length === 0) {
      // C3: detected cycle or unresolvable dependency. Do NOT silently run
      // remaining steps in parallel — fail closed and report stuck step ids.
      return {
        ok: false,
        reason: "cycle_or_unresolvable",
        stuckStepIds: remaining.map((s) => s.stepId),
      };
    }
    waves.push(wave);
    for (const s of wave) {
      resolved.add(s.stepId);
      const idx = remaining.indexOf(s);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }

  return { ok: true, waves };
}

/** @deprecated use {@link resolveDependenciesSafe}. Kept for backward compatibility. */
function resolveDependencies(steps: ExecutionStep[]): ExecutionStep[][] {
  const r = resolveDependenciesSafe(steps);
  return r.ok ? r.waves : [steps];
}

let writeAdaptersLoad: Promise<void> | null = null;

async function ensureAssistantWriteAdaptersLoaded(): Promise<void> {
  if (writeAdaptersLoad) return writeAdaptersLoad;
  writeAdaptersLoad = (async () => {
    const { registerAssistantWriteAdapters } = await import("./assistant-write-adapters");
    registerAssistantWriteAdapters();
  })();
  return writeAdaptersLoad;
}

export async function executePlan(
  plan: ExecutionPlan,
  ctx: ExecutionContext,
): Promise<ExecutionPlan> {
  await ensureAssistantWriteAdaptersLoaded();
  const confirmedSteps = plan.steps.filter((s) => s.status === "confirmed");
  if (confirmedSteps.length === 0) return plan;

  logAssistantTelemetry(AssistantTelemetryAction.WRITE_PLAN_START, {
    planId: plan.planId,
    confirmedStepCount: confirmedSteps.length,
    actions: confirmedSteps.map((s) => s.action).slice(0, 16),
  });

  const planLedger: PlanLedgerContext = {
    planId: plan.planId,
    intentType: plan.intentType,
    productDomain: plan.productDomain,
  };

  const dependencyResolution = resolveDependenciesSafe(confirmedSteps);
  const updatedSteps = [...plan.steps];
  let anyFailed = false;
  const failedOrSkippedStepIds = new Set<string>();

  if (!dependencyResolution.ok) {
    // C3: refuse to execute an unresolvable plan. Mark stuck steps as failed so the
    // UI surfaces a concrete outcome instead of a silent parallel run.
    logAssistantTelemetry(AssistantTelemetryAction.RUN_ERROR, {
      code: "plan_dependency_cycle",
      planId: plan.planId,
      stuckStepIds: dependencyResolution.stuckStepIds.slice(0, 16),
    });
    const stuck = new Set(dependencyResolution.stuckStepIds);
    for (let i = 0; i < updatedSteps.length; i++) {
      const s = updatedSteps[i]!;
      if (!stuck.has(s.stepId)) continue;
      updatedSteps[i] = {
        ...s,
        status: "failed",
        result: {
          ok: false,
          outcome: "failed",
          entityId: null,
          entityType: null,
          warnings: [],
          error:
            "Plán obsahuje cyklickou nebo neřešitelnou závislost — akci nelze bezpečně provést. Zkuste plán vygenerovat znovu.",
        },
      };
    }
    return {
      ...plan,
      steps: updatedSteps,
      status: "partial_failure",
    };
  }
  const waves = dependencyResolution.waves;

  for (const wave of waves) {
    await Promise.all(
      wave.map(async (step) => {
        const idx = updatedSteps.findIndex((s) => s.stepId === step.stepId);
        if (idx < 0) return;

        const hasFailedDependency = step.dependsOn.some((dep) =>
          failedOrSkippedStepIds.has(dep),
        );
        if (hasFailedDependency) {
          const skipResult: ExecutionStepResult = {
            ok: false,
            outcome: "skipped",
            entityId: null,
            entityType: null,
            warnings: [],
            error: "Přeskočeno — závislý krok selhal.",
          };
          updatedSteps[idx] = { ...updatedSteps[idx]!, status: "skipped", result: skipResult };
          failedOrSkippedStepIds.add(step.stepId);
          anyFailed = true;
          logAssistantTelemetry(AssistantTelemetryAction.DEPENDENCY_SKIPPED, {
            stepId: step.stepId,
            action: step.action,
            failedDependencies: step.dependsOn.filter((d) => failedOrSkippedStepIds.has(d)),
          });
          return;
        }

        const baseStep = updatedSteps[idx]!;
        const mergedParams = mergeWriteStepParamsFromCompletedDependencies(baseStep, updatedSteps);
        const stepToRun = { ...baseStep, params: mergedParams };
        updatedSteps[idx] = { ...baseStep, status: "executing", params: mergedParams };
        const result = await executeStep(stepToRun, ctx, planLedger);
        updatedSteps[idx] = {
          ...updatedSteps[idx]!,
          status: result.ok ? "succeeded" : "failed",
          result,
          params: mergedParams,
        };
        if (!result.ok) {
          anyFailed = true;
          failedOrSkippedStepIds.add(step.stepId);
        }
      }),
    );
  }

  const nextPlan: ExecutionPlan = {
    ...plan,
    steps: updatedSteps,
    status: anyFailed ? "partial_failure" : "completed",
    ...(!executionActionsTableAvailable ? { ledgerDegraded: true as const } : {}),
  };

  if (!executionActionsTableAvailable) {
    logAssistantTelemetry(AssistantTelemetryAction.WRITE_PLAN_DONE, {
      planId: nextPlan.planId,
      ledgerDegraded: true,
    });
  }

  logAssistantTelemetry(AssistantTelemetryAction.WRITE_PLAN_DONE, {
    planId: nextPlan.planId,
    finalStatus: nextPlan.status,
    succeeded: updatedSteps.filter((s) => s.status === "succeeded").length,
    failed: updatedSteps.filter((s) => s.status === "failed").length,
    skipped: updatedSteps.filter((s) => s.status === "skipped").length,
    ...(executionActionsTableAvailable ? {} : { ledgerDegraded: true }),
  });

  return nextPlan;
}

export function buildVerifiedResult(
  message: string,
  plan: ExecutionPlan | null,
): VerifiedAssistantResult {
  const entities: VerifiedAssistantResult["referencedEntities"] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const stepOutcomes: VerifiedAssistantResult["stepOutcomes"] = [];

  if (plan) {
    for (const step of plan.steps) {
      const resultOutcome = step.result?.outcome;
      const isIdempotent = resultOutcome === "idempotent_hit" || resultOutcome === "duplicate_hit";
      const isSkipped = step.status === "skipped" || resultOutcome === "skipped";
      const isRequiresInput = resultOutcome === "requires_input";
      const safeError = sanitizeStepErrorForDisplay(step.result?.error, step.action);
      const outcome: VerifiedAssistantResult["stepOutcomes"][number] = {
        stepId: step.stepId,
        action: step.action,
        label: step.label,
        status: isSkipped
          ? "skipped"
          : isRequiresInput
            ? "requires_input"
            : isIdempotent
              ? "idempotent_hit"
              : step.result?.ok
                ? "succeeded"
                : "failed",
        entityId: step.result?.entityId ?? null,
        entityType: step.result?.entityType ?? null,
        error: safeError,
        warnings: step.result?.warnings ?? [],
        retryable: step.result?.retryable,
      };
      stepOutcomes.push(outcome);

      if (step.result?.ok && step.result.entityId) {
        entities.push({
          type: step.result.entityType ?? step.action,
          id: step.result.entityId,
          label: step.label,
        });
      }
      // Only propagate adapter-level warnings (e.g. LTV above 90%).
      // Step-level failure/requires_input messages are shown in StepOutcomeCard and
      // summary message — do not duplicate them into WarningsBlock.
      if (step.result?.warnings) {
        warnings.push(...step.result.warnings);
      }
    }

    const succeeded = plan.steps.filter((s) => s.status === "succeeded").length;
    const failed = plan.steps.filter((s) => s.status === "failed").length;
    const skipped = plan.steps.filter((s) => s.status === "skipped").length;
    const requiresInput = stepOutcomes.filter((o) => o.status === "requires_input").length;
    const total = plan.steps.length;
    if (succeeded === total && total > 0) {
      suggestions.push("Všechny akce byly úspěšně provedeny.");
    }
    if (failed > 0) {
      const retryable = stepOutcomes.filter((o) => o.status === "failed" && o.retryable);
      suggestions.push(`${failed} z ${total} kroků selhalo.`);
      if (retryable.length > 0) {
        suggestions.push("Selhané kroky lze po opravě znovu spustit.");
      }
    }
    if (requiresInput > 0) {
      suggestions.push(`${requiresInput} z ${total} kroků vyžaduje doplnění informací.`);
    }
    if (skipped > 0) {
      suggestions.push(`${skipped} z ${total} kroků přeskočeno kvůli selhání závislosti.`);
    }
  }

  // M4: derive "allSucceeded" from the outcome semantics, not just step.status.
  // idempotent_hit is a success from the advisor's POV (the entity exists); skipped
  // steps that were deselected by the user are not failures either.
  const SUCCESS_OUTCOMES = new Set(["succeeded", "idempotent_hit"]);
  const USER_DESELECTED_ERROR = "Krok nebyl vybrán k provedení.";
  const allSucceeded = plan
    ? stepOutcomes.length > 0 &&
      stepOutcomes.every(
        (o) =>
          SUCCESS_OUTCOMES.has(o.status) ||
          (o.status === "skipped" && o.error === USER_DESELECTED_ERROR),
      )
    : true;
  const hasPartialFailure = plan?.status === "partial_failure";

  const summaryMessage = buildExecutionSummaryMessage(message, plan, stepOutcomes);

  if (plan?.ledgerDegraded) {
    warnings.unshift(ASSISTANT_LEDGER_DEGRADED_ADVISOR_WARNING);
  }

  return {
    message: summaryMessage,
    plan,
    referencedEntities: entities,
    suggestedNextSteps: suggestions,
    warnings,
    confidence: plan?.status === "completed" ? 0.95 : hasPartialFailure ? 0.5 : 0.7,
    stepOutcomes,
    hasPartialFailure,
    allSucceeded,
  };
}

function buildExecutionSummaryMessage(
  baseMessage: string,
  plan: ExecutionPlan | null,
  outcomes: VerifiedAssistantResult["stepOutcomes"],
): string {
  if (!plan || outcomes.length === 0) return baseMessage;

  const succeeded = outcomes.filter((o) => o.status === "succeeded").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  const requiresInput = outcomes.filter((o) => o.status === "requires_input").length;
  const userSkipped = outcomes.filter(
    (o) => o.status === "skipped" && o.error === "Krok nebyl vybrán k provedení.",
  ).length;
  const depSkipped = skipped - userSkipped;
  const total = outcomes.length;

  if (succeeded === total) return baseMessage;

  const lines: string[] = [];
  if (failed > 0 || requiresInput > 0) {
    lines.push("⚠ Některé akce nebyly dokončeny:");
  }
  if (succeeded > 0) lines.push(`✓ ${succeeded} z ${total} provedeno`);
  if (failed > 0) lines.push(`✗ ${failed} z ${total} selhalo`);
  if (requiresInput > 0) lines.push(`⏳ ${requiresInput} z ${total} vyžaduje doplnění`);
  if (depSkipped > 0) lines.push(`↷ ${depSkipped} přeskočeno (závislost na selhaném kroku)`);
  if (userSkipped > 0) lines.push(`○ ${userSkipped} nebylo vybráno`);

  for (const o of outcomes) {
    if (o.status === "failed" && o.error) {
      lines.push(`\n**${o.label}**: ${o.error}`);
    }
    if (o.status === "requires_input" && o.error) {
      lines.push(`\n**${o.label}**: ${o.error}`);
    }
  }

  return lines.join("\n");
}
