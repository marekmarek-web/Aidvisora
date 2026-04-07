/**
 * Mapování image intake action plánu na ExecutionPlan a StepPreviewItem pro UI potvrzení.
 * Samostatný modul bez orchestrátoru (ten tahá DB / review fronty přes importy).
 */

import type { StepPreviewItem } from "../assistant-execution-ui";
import type {
  CanonicalIntentType,
  ExecutionPlan,
  ExecutionStep,
  WriteActionType,
} from "../assistant-domain-model";
import type { ImageIntakeActionPlan } from "./types";

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
    action: (action.writeAction ?? INTENT_TO_WRITE[action.intentType] ?? "createInternalNote") as ExecutionStep["action"],
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

/** Krátké české vysvětlení k typu kroku — bez interních názvů funkcí (createTask atd.). */
const WRITE_ACTION_ADVISOR_DESCRIPTION: Partial<Record<WriteActionType, string>> = {
  createInternalNote: "Poznámka se uloží na kartu klienta.",
  createTask: "Úkol přidáte do úkolů u klienta — před potvrzením zkontrolujte znění.",
  createFollowUp: "Následná aktivita se zaznamená u klienta.",
  attachDocumentToClient: "Podklad přiložíte k dokumentům klienta.",
  draftEmail: "Připraví se koncept e-mailu (nic se neodešle bez dalšího kroku).",
  draftClientPortalMessage: "Připraví se koncept zprávy do portálu klienta.",
  createClientRequest: "Vznikne požadavek klienta k dalšímu zpracování.",
  scheduleCalendarEvent: "Navrhne se událost v kalendáři — ověřte čas a účastníky.",
  createMeetingNote: "Záznam ze schůzky nebo poznámku uložíte k klientovi.",
};

export function mapToPreviewItems(plan: ExecutionPlan): StepPreviewItem[] {
  return plan.steps.map((step) => ({
    stepId: step.stepId,
    label: step.label,
    action: step.label,
    description: WRITE_ACTION_ADVISOR_DESCRIPTION[step.action],
    preflightStatus: "ready" as const,
  }));
}
