/**
 * Maps persisted assistant_messages rows to client-safe chat payloads (advisor drawer / mobile).
 */
import type { ExecutionPlan } from "./assistant-domain-model";
import { normalizeExecutionPlanFromDb } from "./assistant-plan-snapshot";
import type { StepPreviewItem, StepOutcomeSummary } from "./assistant-execution-ui";
/** Namespace import avoids duplicate named bindings if merges duplicate lines in `{ … }`. */
import * as assistantExecutionPlan from "./assistant-execution-plan";
import { sanitizeAssistantMessageForAdvisor, sanitizeWarningForAdvisor } from "./assistant-message-sanitizer";
import type { ImageAssetPayload } from "./assistant-chat-request";
import { parseImageAssetsFromMessageMeta } from "./assistant-user-message-images-meta";

export type AssistantConversationRow = {
  id: string;
  channel: string | null;
  lockedContactId: string | null;
  updatedAt: Date;
};

export type AssistantMessageHistoryRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  meta: Record<string, unknown> | null;
  executionPlanSnapshot: unknown;
  referencedEntities?: unknown;
};

export type AssistantReferencedEntityDto = {
  type: string;
  id: string;
  label?: string;
};

export type AssistantSuggestedNextStepItemDto = {
  label: string;
  message?: string;
  action?: Record<string, unknown>;
};

export type AssistantSuggestedActionDto = {
  type: string;
  label: string;
  payload: Record<string, unknown>;
};

export type AdvisorAssistantHistoryUserMessage = {
  kind: "user";
  stableKey: string;
  content: string;
  createdAtIso: string;
  /** Náhledy z nahraných fotek — drží se v meta zprávy, dokud konverzace existuje. */
  imageAssets?: ImageAssetPayload[];
  /** Část náhledů mohla být vynechána kvůli limitu velikosti meta. */
  chatImagesTruncatedForStorage?: boolean;
};

export type AdvisorAssistantHistoryAssistantMessage = {
  kind: "assistant";
  stableKey: string;
  content: string;
  createdAtIso: string;
  warnings: string[];
  executionState: {
    status: "draft" | "awaiting_confirmation" | "executing" | "completed" | "partial_failure";
    planId?: string;
    totalSteps?: number;
    pendingSteps?: number;
    stepPreviews?: StepPreviewItem[];
    clientLabel?: string;
  } | null;
  contextState: {
    channel: string | null;
    lockedClientId: string | null;
    lockedClientLabel?: string | null;
  } | null;
  referencedEntities?: AssistantReferencedEntityDto[];
  stepOutcomes?: StepOutcomeSummary[];
  suggestedNextSteps?: string[];
  suggestedNextStepItems?: AssistantSuggestedNextStepItemDto[];
  suggestedActions?: AssistantSuggestedActionDto[];
  hasPartialFailure?: boolean;
};

export type AdvisorAssistantHistoryMessageDto =
  | AdvisorAssistantHistoryUserMessage
  | AdvisorAssistantHistoryAssistantMessage;

function stepPreviewsFromPlan(plan: ExecutionPlan): StepPreviewItem[] {
  return plan.steps.map((s) => {
    const pf = assistantExecutionPlan.computeWriteStepPreflight(s.action, s.params);
    const baseVw = assistantExecutionPlan.buildValidationWarnings(s.action, s.params);
    const extra =
      pf.preflightStatus === "needs_input" && pf.advisorMessage && pf.missingFields.length === 0
        ? [pf.advisorMessage]
        : [];
    return {
      stepId: s.stepId,
      label: s.label,
      action: s.label,
      contextHint: assistantExecutionPlan.productDomainChipLabel(
        s.params.productDomain as string | undefined,
      ),
      description: assistantExecutionPlan.buildStepDescription(s.action, s.params),
      domainGroup:
        assistantExecutionPlan.productDomainChipLabel(s.params.productDomain as string | undefined) ?? null,
      validationWarnings: [...baseVw, ...extra],
      preflightStatus: pf.preflightStatus,
      blockedReason: pf.preflightStatus === "blocked" ? pf.advisorMessage : undefined,
    };
  });
}

function executionStateFromPlan(plan: ExecutionPlan | null): AdvisorAssistantHistoryAssistantMessage["executionState"] {
  if (!plan) return null;
  const pendingSteps = plan.steps.filter((s) => s.status === "requires_confirmation").length;
  const showPreviews = plan.status === "awaiting_confirmation" || plan.status === "draft";
  return {
    status: plan.status,
    planId: plan.planId,
    totalSteps: plan.steps.length,
    pendingSteps,
    stepPreviews: showPreviews ? stepPreviewsFromPlan(plan) : undefined,
    clientLabel: undefined,
  };
}

function warningsFromMeta(meta: Record<string, unknown> | null): string[] {
  if (!meta || !Array.isArray(meta.warnings)) return [];
  return meta.warnings
    .filter((w): w is string => typeof w === "string")
    .map(sanitizeWarningForAdvisor)
    .filter((w) => w.length > 0);
}

function referencedEntitiesFromRow(
  rowEntities: unknown,
): AssistantReferencedEntityDto[] | undefined {
  if (!Array.isArray(rowEntities)) return undefined;
  const out: AssistantReferencedEntityDto[] = [];
  for (const e of rowEntities) {
    if (!e || typeof e !== "object") continue;
    const rec = e as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : null;
    const id = typeof rec.id === "string" ? rec.id : null;
    if (!type || !id) continue;
    const label = typeof rec.label === "string" ? rec.label : undefined;
    out.push({ type, id, ...(label ? { label } : {}) });
  }
  return out.length > 0 ? out : undefined;
}

function stepOutcomesFromMeta(
  meta: Record<string, unknown> | null,
): StepOutcomeSummary[] | undefined {
  if (!meta || !Array.isArray(meta.stepOutcomes)) return undefined;
  const out: StepOutcomeSummary[] = [];
  for (const raw of meta.stepOutcomes) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const stepId = typeof rec.stepId === "string" ? rec.stepId : null;
    const action = typeof rec.action === "string" ? rec.action : null;
    const label = typeof rec.label === "string" ? rec.label : null;
    const status = typeof rec.status === "string" ? rec.status : null;
    if (!stepId || !action || !label || !status) continue;
    const allowed = new Set<StepOutcomeSummary["status"]>([
      "succeeded",
      "failed",
      "skipped",
      "requires_input",
      "idempotent_hit",
    ]);
    if (!allowed.has(status as StepOutcomeSummary["status"])) continue;
    out.push({
      stepId,
      action,
      label,
      status: status as StepOutcomeSummary["status"],
      entityId: typeof rec.entityId === "string" ? rec.entityId : null,
      entityType: typeof rec.entityType === "string" ? rec.entityType : null,
      error: typeof rec.error === "string" ? rec.error : null,
      warnings: Array.isArray(rec.warnings)
        ? rec.warnings.filter((x): x is string => typeof x === "string")
        : [],
      retryable: typeof rec.retryable === "boolean" ? rec.retryable : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

function suggestedNextStepsFromMeta(
  meta: Record<string, unknown> | null,
): string[] | undefined {
  if (!meta) return undefined;
  const raw = meta.suggestedNextSteps;
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  return out.length > 0 ? out : undefined;
}

function suggestedNextStepItemsFromMeta(
  meta: Record<string, unknown> | null,
): AssistantSuggestedNextStepItemDto[] | undefined {
  if (!meta || !Array.isArray(meta.suggestedNextStepItems)) return undefined;
  const out: AssistantSuggestedNextStepItemDto[] = [];
  for (const raw of meta.suggestedNextStepItems) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const label = typeof rec.label === "string" ? rec.label : null;
    if (!label) continue;
    const item: AssistantSuggestedNextStepItemDto = { label };
    if (typeof rec.message === "string") item.message = rec.message;
    if (rec.action && typeof rec.action === "object") {
      item.action = rec.action as Record<string, unknown>;
    }
    out.push(item);
  }
  return out.length > 0 ? out : undefined;
}

function suggestedActionsFromMeta(
  meta: Record<string, unknown> | null,
): AssistantSuggestedActionDto[] | undefined {
  if (!meta || !Array.isArray(meta.suggestedActions)) return undefined;
  const out: AssistantSuggestedActionDto[] = [];
  for (const raw of meta.suggestedActions) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const type = typeof rec.type === "string" ? rec.type : null;
    const label = typeof rec.label === "string" ? rec.label : null;
    const payload =
      rec.payload && typeof rec.payload === "object"
        ? (rec.payload as Record<string, unknown>)
        : {};
    if (!type || !label) continue;
    out.push({ type, label, payload });
  }
  return out.length > 0 ? out : undefined;
}

function hasPartialFailureFromMeta(
  meta: Record<string, unknown> | null,
): boolean | undefined {
  if (!meta) return undefined;
  return typeof meta.hasPartialFailure === "boolean" ? meta.hasPartialFailure : undefined;
}

/**
 * Rows must be in chronological order (oldest first).
 */
export function mapAssistantHistoryRowsToClientPayload(
  rows: AssistantMessageHistoryRow[],
  conversation: AssistantConversationRow,
): AdvisorAssistantHistoryMessageDto[] {
  const lastAssistantIndex = (() => {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i]!.role === "assistant") return i;
    }
    return -1;
  })();

  const out: AdvisorAssistantHistoryMessageDto[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.role === "user") {
      const meta = (r.meta as Record<string, unknown> | null) ?? null;
      const { imageAssets, truncatedFlag } = parseImageAssetsFromMessageMeta(meta);
      out.push({
        kind: "user",
        stableKey: r.id,
        content: r.content,
        createdAtIso: r.createdAt.toISOString(),
        ...(imageAssets.length > 0 ? { imageAssets } : {}),
        ...(truncatedFlag ? { chatImagesTruncatedForStorage: true } : {}),
      });
      continue;
    }
    if (r.role === "system") {
      continue;
    }
    const plan = normalizeExecutionPlanFromDb(r.executionPlanSnapshot);
    const isLastAssistant = i === lastAssistantIndex;
    const lockedId = isLastAssistant ? conversation.lockedContactId : null;
    const refEntities = referencedEntitiesFromRow(r.referencedEntities);
    const outcomes = stepOutcomesFromMeta(r.meta);
    const nextStepItems = suggestedNextStepItemsFromMeta(r.meta);
    const nextStepStrings = suggestedNextStepsFromMeta(r.meta);
    const suggestedActions = suggestedActionsFromMeta(r.meta);
    const hasPartialFailure = hasPartialFailureFromMeta(r.meta);
    out.push({
      kind: "assistant",
      stableKey: r.id,
      content: sanitizeAssistantMessageForAdvisor(r.content),
      createdAtIso: r.createdAt.toISOString(),
      warnings: warningsFromMeta(r.meta),
      executionState: executionStateFromPlan(plan),
      contextState:
        lockedId != null
          ? {
              channel: conversation.channel,
              lockedClientId: lockedId,
              lockedClientLabel: null,
            }
          : null,
      ...(refEntities ? { referencedEntities: refEntities } : {}),
      ...(outcomes ? { stepOutcomes: outcomes } : {}),
      ...(nextStepItems ? { suggestedNextStepItems: nextStepItems } : {}),
      ...(nextStepStrings ? { suggestedNextSteps: nextStepStrings } : {}),
      ...(suggestedActions ? { suggestedActions } : {}),
      ...(hasPartialFailure !== undefined ? { hasPartialFailure } : {}),
    });
  }
  return out;
}
