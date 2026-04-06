import type { CanonicalIntent, CanonicalIntentType } from "../assistant-domain-model";
import { ASSISTANT_PLAYBOOKS } from "./definitions";
import type { AssistantPlaybook } from "./types";

/**
 * 3G: Write intents for which playbook priorityMissingHints are surfaced as advisory hints.
 *
 * Expanded from the original set (create_opportunity, create_service_case, update_opportunity)
 * to cover request, material, task, meeting and follow-up write intents.
 *
 * Intents NOT in this set still receive a playbook match (for domain inference + guidance lines)
 * but do NOT get individual `hint:…` entries injected into userConstraints.
 */
const PLAYBOOK_HINT_INTENTS = new Set<CanonicalIntentType>([
  "create_opportunity",
  "update_opportunity",
  "create_service_case",
  "create_client_request",
  "update_client_request",
  "create_material_request",
  "request_client_documents",
  "create_task",
  "create_followup",
  "schedule_meeting",
  "create_reminder",
]);

export function pickPlaybookForIntent(intent: CanonicalIntent, message: string): AssistantPlaybook | null {
  const m = message.toLowerCase();
  for (const pb of ASSISTANT_PLAYBOOKS) {
    if (pb.matches(m, intent)) return pb;
  }
  return null;
}

/**
 * Normalise a hint phrase to a lookup key for dedup checking.
 *
 * Examples:
 *   "částka jistiny"            → "částka"
 *   "LTV nebo zástavní hodnota" → "ltv"
 *   "horizont"                  → "horizont"
 *   "investiční horizont"       → "investiční"   (first word, lowercase)
 *
 * We strip parenthetical qualifiers before taking the first word so that
 * "účel (koupě, rekonstrukce)" normalises to "účel", not "(koupě,".
 */
function hintToLookupKey(hint: string): string {
  return hint
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase() ?? "";
}

function hasOnlyImplicitGeneralChatActions(intent: CanonicalIntent): boolean {
  return intent.requestedActions.length === 0 || (
    intent.requestedActions.length === 1 && intent.requestedActions[0] === "general_chat"
  );
}

function looksLikeExplicitActionBundleRequest(message: string): boolean {
  return /\b(vytvoř|vytvor|založ|zaloz|udělej|udelej|pošli|posli|naplánuj|naplanuj|zapiš|zapis|vyžádej|vyzadej|nastav)\b/i.test(message);
}

/**
 * Doplní productDomain a uživatelské hints z playbooku (bez LLM).
 * Pro write intenty propaguje priorityMissingHints jako `hint:…` záznamy
 * do userConstraints, aby byly dostupné pro planner a UX vrstvu.
 *
 * Hint je přeskočen pokud:
 *  - existuje extractedFact se shodným lookup klíčem, nebo
 *  - userConstraints už obsahuje `hint:` začínající tímto klíčem, nebo
 *  - playbook má `supportedIntents` a aktuální intent v nich není.
 */
export function enrichCanonicalIntentWithPlaybooks(intent: CanonicalIntent, message: string): CanonicalIntent {
  const pb = pickPlaybookForIntent(intent, message);
  if (!pb) return intent;

  const next: CanonicalIntent = {
    ...intent,
    userConstraints: [...intent.userConstraints],
  };

  if (!next.productDomain && pb.defaultProductDomain) {
    next.productDomain = pb.defaultProductDomain;
  }

  if (!next.userConstraints.includes(`playbook:${pb.id}`)) {
    next.userConstraints.push(`playbook:${pb.id}`);
  }

  if (
    pb.defaultRequestedActions &&
    pb.defaultRequestedActions.length > 0 &&
    (
      hasOnlyImplicitGeneralChatActions(intent) ||
      (
        intent.requestedActions.length === 1 &&
        intent.requestedActions[0] === "create_opportunity" &&
        !looksLikeExplicitActionBundleRequest(message)
      )
    )
  ) {
    next.requestedActions = [...pb.defaultRequestedActions];
    next.intentType =
      next.requestedActions.length > 1 ? "multi_action" : next.requestedActions[0] ?? next.intentType;
  }

  // Determine whether this intent should receive individual hint entries.
  const intentInGlobalSet = PLAYBOOK_HINT_INTENTS.has(intent.intentType);
  const intentInPlaybookSet =
    pb.supportedIntents != null && pb.supportedIntents.includes(intent.intentType);
  const shouldSurfaceHints = intentInGlobalSet || intentInPlaybookSet;

  if (shouldSurfaceHints && pb.priorityMissingHints.length > 0) {
    const existingFactKeys = new Set(intent.extractedFacts.map((f) => f.key.toLowerCase()));
    for (const hint of pb.priorityMissingHints) {
      const hintKey = hintToLookupKey(hint);
      if (!hintKey) continue;
      const alreadyCovered =
        existingFactKeys.has(hintKey) ||
        intent.userConstraints.some((c) => c.startsWith(`hint:${hintKey}`));
      if (!alreadyCovered) {
        next.userConstraints.push(`hint:${hint}`);
      }
    }
  }

  return next;
}

export function getPlaybookGuidanceLines(intent: CanonicalIntent, message: string): string[] {
  const pb = pickPlaybookForIntent(intent, message);
  if (!pb) return [];
  return [`Playbook: ${pb.label}`, ...pb.nextStepSuggestions.map((s) => `• ${s}`)];
}

/**
 * Returns all guidance lines from all matching playbooks for diagnostic / test use.
 * In production, `pickPlaybookForIntent` always returns the first match (deterministic).
 */
export function getAllMatchingPlaybookIds(intent: CanonicalIntent, message: string): string[] {
  const m = message.toLowerCase();
  return ASSISTANT_PLAYBOOKS.filter((pb) => pb.matches(m, intent)).map((pb) => pb.id);
}
