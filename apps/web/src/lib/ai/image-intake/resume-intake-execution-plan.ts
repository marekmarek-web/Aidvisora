/**
 * Po úspěšném doplnění klienta k ambiguous image intake sestaví nový execution plán
 * (stejná kanonická akční plocha jako při běžném intake s jistou vazbou).
 */

import type { ExecutionPlan } from "../assistant-domain-model";
import type { PendingImageIntakeResolution } from "../assistant-session";
import type { ClientBindingResult, ExtractedFactBundle, ImageInputType, InputClassificationResult } from "./types";
import { IMAGE_INPUT_TYPES } from "./types";
import { buildActionPlanV4 } from "./planner";
import { mapToExecutionPlan } from "./intake-execution-plan-mapper";

function isImageInputType(x: string): x is ImageInputType {
  return (IMAGE_INPUT_TYPES as readonly string[]).includes(x);
}

/**
 * Obnoví klasifikaci z uloženého intake; při neznámé hodnotě odvodí typ z faktů.
 */
export function resolveResumeInputType(
  storedInputType: string | null,
  factBundle: ExtractedFactBundle,
): ImageInputType {
  if (storedInputType && isImageInputType(storedInputType)) {
    return storedInputType;
  }
  const keys = new Set(factBundle.facts.map((f) => f.factKey));
  if (
    keys.has("what_client_said") ||
    keys.has("what_client_wants") ||
    keys.has("required_follow_up") ||
    keys.has("urgency_signal")
  ) {
    return "screenshot_client_communication";
  }
  if (keys.has("amount") || keys.has("account_number") || keys.has("variable_symbol") || keys.has("due_date")) {
    return "screenshot_payment_details";
  }
  if (keys.has("document_type") || keys.has("document_summary")) {
    return "photo_or_scan_document";
  }
  return "screenshot_client_communication";
}

function syntheticClassification(inputType: ImageInputType): InputClassificationResult {
  return {
    inputType,
    subtype: null,
    confidence: 0.85,
    containsText: true,
    likelyMessageThread: inputType === "screenshot_client_communication",
    likelyDocument: inputType === "photo_or_scan_document",
    likelyPayment: inputType === "screenshot_payment_details",
    likelyFinancialInfo: inputType === "screenshot_bank_or_finance_info",
    uncertaintyFlags: [],
  };
}

function boundBinding(clientId: string, clientLabel: string): ClientBindingResult {
  return {
    state: "bound_client_confident",
    clientId,
    clientLabel,
    confidence: 1,
    candidates: [],
    source: "session_context",
    warnings: [],
  };
}

/**
 * Vrátí plán k potvrzení nebo null, pokud planner nenavrhl žádné kroky.
 */
export function buildExecutionPlanAfterIntakeResume(
  intakeId: string,
  pending: PendingImageIntakeResolution,
  clientId: string,
  clientLabel: string,
): ExecutionPlan | null {
  const inputType = resolveResumeInputType(pending.inputType, pending.factBundle);
  const classification = syntheticClassification(inputType);
  const binding = boundBinding(clientId, clientLabel);
  const actionPlan = buildActionPlanV4(
    classification,
    binding,
    pending.factBundle,
    pending.actionPlan.draftReplyText,
    null,
    null,
  );
  if (actionPlan.recommendedActions.length === 0) {
    return null;
  }
  return mapToExecutionPlan(intakeId, actionPlan, clientId, null);
}
