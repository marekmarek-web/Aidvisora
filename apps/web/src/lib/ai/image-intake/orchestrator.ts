/**
 * AI Photo / Image Intake — orchestration adapter.
 *
 * Connects the image intake lane to the existing assistant orchestration.
 * Reuses canonical action surface, preview/confirm flow and write actions.
 * No new write engine — all writes go through existing ExecutionPlan → executePlan path.
 */

import { randomUUID } from "crypto";
import type { StepPreviewItem } from "../assistant-execution-ui";
import type { ExecutionPlan, ExecutionStep, CanonicalIntentType } from "../assistant-domain-model";
import type { AssistantSession } from "../assistant-session";

import type {
  ImageIntakeRequest,
  ImageIntakeResponse,
  ImageIntakeTrace,
  ImageIntakeActionPlan,
  ImageIntakeActionCandidate,
  ImageIntakePreviewPayload,
  NormalizedImageAsset,
  LaneDecisionResult,
  InputClassificationResult,
  ClientBindingResult,
  CaseBindingResult,
  ExtractedFactBundle,
  ImageOutputMode,
} from "./types";
import { emptyFactBundle, emptyActionPlan } from "./types";
import { runBatchPreflight } from "./preflight";
import { enforceImageIntakeGuardrails, safeOutputModeForUncertainInput } from "./guardrails";

// ---------------------------------------------------------------------------
// Lane decision (deterministic in Phase 1; Phase 2 adds classifier)
// ---------------------------------------------------------------------------

function decideLane(
  _assets: NormalizedImageAsset[],
  _accompanyingText: string | null,
): LaneDecisionResult {
  return {
    lane: "image_intake",
    confidence: 1.0,
    reason: "Image input routed to image intake lane (Phase 1 default).",
    handoffReason: null,
  };
}

// ---------------------------------------------------------------------------
// Classification stub (Phase 2 replaces with model-based classifier)
// ---------------------------------------------------------------------------

function classifyInput(
  _assets: NormalizedImageAsset[],
  _accompanyingText: string | null,
): InputClassificationResult {
  return {
    inputType: "mixed_or_uncertain_image",
    subtype: null,
    confidence: 0.0,
    containsText: false,
    likelyMessageThread: false,
    likelyDocument: false,
    likelyPayment: false,
    likelyFinancialInfo: false,
    uncertaintyFlags: ["phase1_stub_no_classifier"],
  };
}

// ---------------------------------------------------------------------------
// Client / case binding (from session context in Phase 1)
// ---------------------------------------------------------------------------

function resolveClientBinding(
  request: ImageIntakeRequest,
  session: AssistantSession | null,
): ClientBindingResult {
  const sessionClientId = session?.lockedClientId ?? session?.activeClientId ?? null;
  const requestClientId = request.activeClientId;

  const clientId = sessionClientId ?? requestClientId;

  if (clientId) {
    return {
      state: "bound_client_confident",
      clientId,
      clientLabel: null,
      confidence: sessionClientId ? 0.9 : 0.7,
      candidates: [],
      source: sessionClientId ? "session_context" : "ui_context",
      warnings: [],
    };
  }

  return {
    state: "insufficient_binding",
    clientId: null,
    clientLabel: null,
    confidence: 0.0,
    candidates: [],
    source: "none",
    warnings: ["Klient nebyl identifikován — write-ready plán nelze vytvořit."],
  };
}

function resolveCaseBinding(
  request: ImageIntakeRequest,
  session: AssistantSession | null,
): CaseBindingResult {
  const caseId = session?.lockedOpportunityId ?? request.activeOpportunityId ?? null;

  if (caseId) {
    return {
      state: "bound_case_confident",
      caseId,
      caseLabel: null,
      confidence: 0.8,
      candidates: [],
      source: "session_context",
    };
  }

  return {
    state: "insufficient_binding",
    caseId: null,
    caseLabel: null,
    confidence: 0.0,
    candidates: [],
    source: "none",
  };
}

// ---------------------------------------------------------------------------
// Action plan stub (Phase 2 replaces with model-based planner)
// ---------------------------------------------------------------------------

function buildActionPlanStub(
  classification: InputClassificationResult,
  clientBinding: ClientBindingResult,
): ImageIntakeActionPlan {
  const outputMode = safeOutputModeForUncertainInput(classification, clientBinding);
  return emptyActionPlan(outputMode);
}

// ---------------------------------------------------------------------------
// Map image intake actions → canonical ExecutionPlan (reuse existing surface)
// ---------------------------------------------------------------------------

const INTENT_TO_WRITE: Partial<Record<CanonicalIntentType, string>> = {
  create_task: "createTask",
  create_followup: "createFollowUp",
  schedule_meeting: "scheduleCalendarEvent",
  create_note: "createMeetingNote",
  create_internal_note: "createInternalNote",
  create_client_request: "createClientRequest",
  attach_document: "attachDocumentToClient",
  draft_portal_message: "draftClientPortalMessage",
};

export function mapToExecutionPlan(
  intakeId: string,
  actionPlan: ImageIntakeActionPlan,
  clientId: string | null,
  opportunityId: string | null,
): ExecutionPlan {
  const steps: ExecutionStep[] = actionPlan.recommendedActions.map((action, idx) => ({
    stepId: `${intakeId}_s${idx}`,
    action: (action.writeAction ?? INTENT_TO_WRITE[action.intentType] ?? "createInternalNote") as any,
    params: {
      ...action.params,
      contactId: clientId,
      opportunityId,
      _imageIntakeSource: intakeId,
    },
    label: action.label,
    requiresConfirmation: true,
    isReadOnly: false,
    dependsOn: [],
    status: "requires_confirmation" as const,
    result: null,
  }));

  return {
    planId: intakeId,
    intentType: actionPlan.recommendedActions[0]?.intentType ?? "general_chat",
    productDomain: null,
    contactId: clientId,
    opportunityId,
    steps,
    status: steps.length > 0 ? "awaiting_confirmation" : "completed",
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Map to StepPreviewItem[] (reuse existing preview/confirm UI)
// ---------------------------------------------------------------------------

export function mapToPreviewItems(plan: ExecutionPlan): StepPreviewItem[] {
  return plan.steps.map((step) => ({
    stepId: step.stepId,
    label: step.label,
    action: step.label,
    description: `Image intake: ${step.action}`,
    preflightStatus: "ready" as const,
  }));
}

// ---------------------------------------------------------------------------
// Build preview payload for image intake
// ---------------------------------------------------------------------------

export function buildImageIntakePreview(
  intakeId: string,
  classification: InputClassificationResult | null,
  clientBinding: ClientBindingResult,
  caseBinding: CaseBindingResult,
  factBundle: ExtractedFactBundle,
  actionPlan: ImageIntakeActionPlan,
): ImageIntakePreviewPayload {
  const writeReady =
    actionPlan.recommendedActions.length > 0 &&
    !actionPlan.needsAdvisorInput &&
    (clientBinding.state === "bound_client_confident" || clientBinding.state === "bound_case_confident");

  return {
    intakeId,
    outputMode: actionPlan.outputMode,
    inputType: classification?.inputType ?? "mixed_or_uncertain_image",
    clientLabel: clientBinding.clientLabel,
    caseLabel: caseBinding.caseLabel,
    summary: actionPlan.whyThisAction || "Image intake zpracování (Phase 1 stub).",
    factsSummary: factBundle.facts.map((f) => `${f.factType}: ${f.value ?? "–"}`),
    uncertainties: [
      ...factBundle.ambiguityReasons,
      ...(classification?.uncertaintyFlags ?? []),
    ],
    recommendedActions: actionPlan.recommendedActions.map((a) => ({
      label: a.label,
      action: a.intentType,
      reason: a.reason,
    })),
    writeReady,
    warnings: [
      ...clientBinding.warnings,
      ...actionPlan.safetyFlags,
    ],
  };
}

// ---------------------------------------------------------------------------
// Main orchestration entrypoint
// ---------------------------------------------------------------------------

export type ImageIntakeOrchestratorResult = {
  response: ImageIntakeResponse;
  executionPlan: ExecutionPlan | null;
  previewPayload: ImageIntakePreviewPayload;
};

export function processImageIntake(
  request: ImageIntakeRequest,
  session: AssistantSession | null,
): ImageIntakeOrchestratorResult {
  const startTime = Date.now();
  const intakeId = `img_${randomUUID().slice(0, 12)}`;

  // 1. Batch preflight
  const batchPreflight = runBatchPreflight(request.assets, request.sessionId);
  const primaryPreflight = batchPreflight.assetResults[0]?.result ?? {
    eligible: false,
    qualityLevel: "unusable" as const,
    isDuplicate: false,
    mimeSupported: false,
    sizeWithinLimits: false,
    rejectReason: "no_assets",
    warnings: ["Žádné obrázky."],
  };

  // 2. Lane decision
  const laneDecision = decideLane(request.assets, request.accompanyingText);

  // 3. Classification (stub in Phase 1)
  const classification = batchPreflight.eligible
    ? classifyInput(request.assets, request.accompanyingText)
    : null;

  // 4. Client / case binding
  const clientBinding = resolveClientBinding(request, session);
  const caseBinding = resolveCaseBinding(request, session);

  // 5. Fact extraction (stub in Phase 1)
  const factBundle = emptyFactBundle();

  // 6. Action planning (stub in Phase 1)
  const actionPlan = classification
    ? buildActionPlanStub(classification, clientBinding)
    : emptyActionPlan("no_action_archive_only");

  // 7. Guardrails
  const guardrailVerdict = enforceImageIntakeGuardrails(
    laneDecision,
    classification,
    clientBinding,
    actionPlan,
  );

  // Apply guardrail downgrade
  if (guardrailVerdict.modeDowngraded && guardrailVerdict.downgradedTo) {
    actionPlan.outputMode = guardrailVerdict.downgradedTo;
    actionPlan.needsAdvisorInput = true;
    actionPlan.safetyFlags.push(
      ...guardrailVerdict.violations,
    );
  }

  // Strip disallowed actions
  if (guardrailVerdict.strippedActions.length > 0) {
    const strippedIds = new Set(guardrailVerdict.strippedActions.map((a) => a.intentType));
    actionPlan.recommendedActions = actionPlan.recommendedActions.filter(
      (a) => !strippedIds.has(a.intentType),
    );
  }

  // 8. Map to execution plan (for preview/confirm reuse)
  const executionPlan = actionPlan.recommendedActions.length > 0
    ? mapToExecutionPlan(intakeId, actionPlan, clientBinding.clientId, caseBinding.caseId)
    : null;

  const previewSteps = executionPlan ? mapToPreviewItems(executionPlan) : [];

  // 9. Build preview payload
  const previewPayload = buildImageIntakePreview(
    intakeId,
    classification,
    clientBinding,
    caseBinding,
    factBundle,
    actionPlan,
  );

  // 10. Build trace
  const trace: ImageIntakeTrace = {
    intakeId,
    sessionId: request.sessionId,
    assetIds: request.assets.map((a) => a.assetId),
    laneDecision: laneDecision.lane,
    inputType: classification?.inputType ?? null,
    outputMode: actionPlan.outputMode,
    clientBindingState: clientBinding.state,
    factCount: factBundle.facts.length,
    actionCount: actionPlan.recommendedActions.length,
    writeReady: previewPayload.writeReady,
    guardrailsTriggered: guardrailVerdict.violations,
    durationMs: Date.now() - startTime,
    timestamp: new Date(),
  };

  const response: ImageIntakeResponse = {
    intakeId,
    laneDecision,
    preflight: primaryPreflight,
    classification,
    clientBinding,
    caseBinding,
    factBundle,
    actionPlan,
    previewSteps,
    trace,
  };

  return { response, executionPlan, previewPayload };
}
