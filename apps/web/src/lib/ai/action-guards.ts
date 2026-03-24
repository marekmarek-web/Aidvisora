/**
 * Action guards for validating assistant-suggested action execution (Plan 5B.4).
 * Pipeline of pre-execution checks.
 */

import type { ActionPayload, ExecutionMode } from "./action-catalog";

export type ActionGuardContext = {
  tenantId: string;
  userId: string;
  roleName: string;
  reviewRow?: {
    tenantId: string;
    reviewStatus: string | null;
    matchedClientId: string | null;
    matchedClientCandidates: unknown;
    processingStatus: string;
    confidence: number | null;
    extractionTrace?: Record<string, unknown>;
    extractedPayload?: Record<string, unknown>;
    detectedDocumentType?: string | null;
  };
};

export type GuardResult = {
  allowed: boolean;
  blockedReasons: string[];
  requiredOverrides: string[];
};

type GuardCheck = (action: ActionPayload, ctx: ActionGuardContext) => GuardResult | null;

function checkTenantIsolation(action: ActionPayload, ctx: ActionGuardContext): GuardResult | null {
  if (ctx.reviewRow && ctx.reviewRow.tenantId !== ctx.tenantId) {
    return { allowed: false, blockedReasons: ["TENANT_MISMATCH"], requiredOverrides: [] };
  }
  return null;
}

function checkPermission(_action: ActionPayload, ctx: ActionGuardContext): GuardResult | null {
  const draftActions = ["create_task_draft", "create_followup_draft", "create_email_draft"];
  const applyActions = ["prepare_payment_apply", "prepare_contract_apply", "confirm_create_new_client"];

  if (draftActions.includes(_action.actionType) && ctx.roleName === "Viewer") {
    return { allowed: false, blockedReasons: ["INSUFFICIENT_PERMISSION"], requiredOverrides: [] };
  }
  if (applyActions.includes(_action.actionType) && !["Admin", "Manager", "Advisor"].includes(ctx.roleName)) {
    return { allowed: false, blockedReasons: ["INSUFFICIENT_PERMISSION"], requiredOverrides: [] };
  }
  return null;
}

function checkQualityGate(action: ActionPayload, ctx: ActionGuardContext): GuardResult | null {
  if (!["prepare_contract_apply", "prepare_payment_apply"].includes(action.actionType)) return null;
  if (!ctx.reviewRow) return null;

  try {
    const { evaluateApplyReadiness } = require("./quality-gates");
    const gate = evaluateApplyReadiness(ctx.reviewRow);
    if (gate.readiness === "blocked_for_apply") {
      return {
        allowed: false,
        blockedReasons: gate.blockedReasons,
        requiredOverrides: gate.blockedReasons,
      };
    }
  } catch { /* quality gates not available */ }
  return null;
}

function checkDuplicatePrevention(action: ActionPayload, _ctx: ActionGuardContext): GuardResult | null {
  if (action.payload._isDuplicate === true) {
    return { allowed: false, blockedReasons: ["DUPLICATE_ACTION"], requiredOverrides: [] };
  }
  return null;
}

function checkClientSelection(action: ActionPayload, ctx: ActionGuardContext): GuardResult | null {
  if (!["prepare_contract_apply"].includes(action.actionType)) return null;
  if (!ctx.reviewRow) return null;

  if (!ctx.reviewRow.matchedClientId) {
    const candidates = ctx.reviewRow.matchedClientCandidates;
    const hasMultiple = Array.isArray(candidates) && candidates.length > 1;
    if (hasMultiple) {
      return { allowed: false, blockedReasons: ["AMBIGUOUS_CLIENT_MATCH"], requiredOverrides: ["select_client_candidate"] };
    }
    if (!candidates || (Array.isArray(candidates) && candidates.length === 0)) {
      return { allowed: false, blockedReasons: ["NO_CLIENT_MATCH"], requiredOverrides: ["confirm_create_new_client"] };
    }
  }
  return null;
}

function checkExecutionMode(action: ActionPayload, _ctx: ActionGuardContext): GuardResult | null {
  const mode: ExecutionMode = action.executionMode;
  if (mode === "auto_disabled") {
    return { allowed: false, blockedReasons: ["AUTO_DISABLED"], requiredOverrides: [] };
  }
  return null;
}

const GUARD_PIPELINE: GuardCheck[] = [
  checkTenantIsolation,
  checkPermission,
  checkQualityGate,
  checkDuplicatePrevention,
  checkClientSelection,
  checkExecutionMode,
];

export function validateActionExecution(
  action: ActionPayload,
  ctx: ActionGuardContext,
): GuardResult {
  const allBlocked: string[] = [];
  const allOverrides: string[] = [];

  for (const check of GUARD_PIPELINE) {
    const result = check(action, ctx);
    if (result && !result.allowed) {
      allBlocked.push(...result.blockedReasons);
      allOverrides.push(...result.requiredOverrides);
    }
  }

  if (allBlocked.length > 0) {
    return { allowed: false, blockedReasons: allBlocked, requiredOverrides: allOverrides };
  }
  return { allowed: true, blockedReasons: [], requiredOverrides: [] };
}
