import type { ActionPayload, ActionType } from "./action-catalog";
import type { SuggestedAction } from "./dashboard-types";

/** Mapuje katalogové akce asistenta na tlačítka v UI (dashboard `SuggestedAction`). */
export function mapActionPayloadToSuggestedAction(a: ActionPayload): SuggestedAction | null {
  const id = a.entityId;
  const label = a.label;
  const basePayload = { ...a.payload };

  switch (a.actionType as ActionType) {
    case "open_review":
    case "prepare_contract_apply":
    case "prepare_payment_apply":
      if (a.entityType === "review") {
        return { type: "open_review", label, payload: { reviewId: id, ...basePayload } };
      }
      return null;
    case "create_task_draft":
    case "create_followup_draft":
      return { type: "create_task", label, payload: { taskId: id, ...basePayload } };
    case "create_email_draft":
      return { type: "draft_email", label, payload: { clientId: id, ...basePayload } };
    case "select_client_candidate":
    case "confirm_create_new_client":
      if (a.entityType === "contact" || a.entityType === "client") {
        return { type: "view_client", label, payload: { clientId: id, ...basePayload } };
      }
      return null;
    case "request_missing_data":
    case "show_portal_payment_preview":
      return null;
    default:
      return null;
  }
}

export function mapActionPayloadsToSuggestedActions(actions: ActionPayload[]): SuggestedAction[] {
  const out: SuggestedAction[] = [];
  for (const a of actions) {
    const m = mapActionPayloadToSuggestedAction(a);
    if (m) out.push(m);
  }
  return out;
}
