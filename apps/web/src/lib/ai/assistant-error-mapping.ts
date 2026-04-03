/**
 * Centralized error mapping for the assistant execution layer.
 * Separates internal errors from user-facing display messages
 * and ensures no raw DB/SQL/stack trace content reaches the UI.
 */

type ErrorClassification =
  | "db_relation_missing"
  | "db_constraint_violation"
  | "db_null_violation"
  | "db_foreign_key"
  | "db_unique_violation"
  | "auth_mismatch"
  | "permission_denied"
  | "timeout"
  | "service_unavailable"
  | "runtime_error"
  | "unknown";

type ErrorPattern = {
  classification: ErrorClassification;
  test: (msg: string) => boolean;
  userMessage: string;
};

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    classification: "db_relation_missing",
    test: (m) => m.includes("relation") && m.includes("does not exist"),
    userMessage: "Interní databázový problém — chybí tabulka. Kontaktujte správce systému.",
  },
  {
    classification: "db_unique_violation",
    test: (m) => m.includes("duplicate key") || m.includes("unique constraint"),
    userMessage: "Záznam již existuje — nelze vytvořit duplicitní položku.",
  },
  {
    classification: "db_null_violation",
    test: (m) => m.includes("null value in column") || m.includes("violates not-null"),
    userMessage: "Chybí povinné údaje pro tuto akci.",
  },
  {
    classification: "db_foreign_key",
    test: (m) => m.includes("foreign key constraint") || m.includes("violates foreign key"),
    userMessage: "Odkazovaný záznam neexistuje nebo byl smazán.",
  },
  {
    classification: "auth_mismatch",
    test: (m) => m.includes("Nesoulad") || m.includes("mismatch"),
    userMessage: "Bezpečnostní nesoulad — ověřte přihlášení a zkuste znovu.",
  },
  {
    classification: "permission_denied",
    test: (m) =>
      m.includes("permission") ||
      m.includes("oprávnění") ||
      m.toLowerCase().includes("forbidden"),
    userMessage: "Nemáte oprávnění pro tuto akci.",
  },
  {
    classification: "timeout",
    test: (m) =>
      m.toLowerCase().includes("timeout") ||
      m.toLowerCase().includes("timed out") ||
      m.includes("ETIMEDOUT"),
    userMessage: "Požadavek trval příliš dlouho. Zkuste to znovu.",
  },
  {
    classification: "service_unavailable",
    test: (m) =>
      m.includes("ECONNREFUSED") ||
      m.includes("ENOTFOUND") ||
      m.includes("fetch failed") ||
      m.includes("network"),
    userMessage: "Služba je dočasně nedostupná. Zkuste to za chvíli.",
  },
  {
    classification: "runtime_error",
    test: (m) =>
      m.includes("Cannot read properties") ||
      m.includes("is not a function") ||
      m.includes("is not defined") ||
      m.includes("TypeError") ||
      m.includes("ReferenceError"),
    userMessage: "Došlo k neočekávané chybě. Zkuste to znovu nebo kontaktujte podporu.",
  },
];

function classify(rawMessage: string): ErrorPattern | null {
  const lower = rawMessage.toLowerCase();
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(lower) || pattern.test(rawMessage)) {
      return pattern;
    }
  }
  return null;
}

function looksLikeInternalError(msg: string): boolean {
  if (msg.length > 200) return true;
  if (/\bat\b.*\.(ts|js|tsx|jsx):\d+/.test(msg)) return true;
  if (/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE/i.test(msg) && msg.length > 60) return true;
  if (/Error:\s/.test(msg) && msg.includes("\n")) return true;
  if (/[a-z_]+\.[a-z_]+\.[a-z_]+/.test(msg) && msg.includes("error")) return true;
  return false;
}

const PER_ACTION_FALLBACK: Record<string, string> = {
  createOpportunity: "Obchod se nepodařilo vytvořit.",
  updateOpportunity: "Aktualizace obchodu se nezdařila.",
  createServiceCase: "Servisní případ se nepodařilo založit.",
  createTask: "Úkol se nepodařilo vytvořit.",
  createFollowUp: "Follow-up se nepodařilo naplánovat.",
  scheduleCalendarEvent: "Událost se nepodařila naplánovat.",
  createMeetingNote: "Poznámku se nepodařilo uložit.",
  appendMeetingNote: "Poznámku se nepodařilo doplnit.",
  createInternalNote: "Interní poznámku se nepodařilo uložit.",
  attachDocumentToClient: "Dokument se nepodařilo přiřadit.",
  attachDocumentToOpportunity: "Dokument se nepodařilo přiřadit k obchodu.",
  classifyDocument: "Klasifikace dokumentu selhala.",
  triggerDocumentReview: "Review dokumentu se nepodařilo spustit.",
  createClientRequest: "Požadavek klienta se nepodařilo vytvořit.",
  updateClientRequest: "Aktualizace požadavku selhala.",
  createMaterialRequest: "Požadavek na podklady se nepodařilo odeslat.",
  publishPortfolioItem: "Publikace do portfolia selhala.",
  updatePortfolioItem: "Aktualizace portfolia selhala.",
  createReminder: "Připomínku se nepodařilo uložit.",
  draftEmail: "Koncept e-mailu se nepodařilo vytvořit.",
  draftClientPortalMessage: "Koncept zprávy se nepodařilo vytvořit.",
  sendPortalMessage: "Odeslání portálové zprávy selhalo.",
  approveAiContractReview: "Schválení AI kontroly selhalo.",
  applyAiContractReviewToCrm: "Zápis AI kontroly do CRM selhal.",
  linkAiContractReviewToDocuments: "Propojení souboru z AI kontroly selhalo.",
  setDocumentVisibleToClient: "Změna viditelnosti dokumentu selhala.",
  linkDocumentToMaterialRequest: "Přiřazení dokumentu k požadavku selhalo.",
  createClientPortalNotification: "Odeslání upozornění klientovi selhalo.",
};

/**
 * Maps a raw error message to a safe, user-facing Czech message.
 * Logs the original error internally for debugging.
 *
 * @param rawError - The original error message (may contain SQL, stack traces, etc.)
 * @param action - Optional write action type for per-action fallback messages
 * @param context - Optional context string for log output (e.g. "step xyz")
 */
export function mapErrorForAdvisor(
  rawError: string,
  action?: string | null,
  context?: string,
): string {
  if (!rawError) {
    return action ? (PER_ACTION_FALLBACK[action] ?? "Akce se nezdařila.") : "Akce se nezdařila.";
  }

  const logPrefix = context ? `[assistant-error] ${context}:` : "[assistant-error]";
  console.error(logPrefix, rawError);

  const classified = classify(rawError);
  if (classified) {
    return classified.userMessage;
  }

  if (looksLikeInternalError(rawError)) {
    return action
      ? (PER_ACTION_FALLBACK[action] ?? "Akce se nezdařila. Zkuste to znovu.")
      : "Akce se nezdařila. Zkuste to znovu.";
  }

  if (rawError.length > 120) {
    return action
      ? (PER_ACTION_FALLBACK[action] ?? "Akce se nezdařila. Zkuste to znovu.")
      : rawError.slice(0, 100) + "…";
  }

  return rawError;
}

/**
 * Sanitizes an error message that's already stored in a step outcome
 * before it reaches the UI warnings array.
 */
export function sanitizeStepErrorForDisplay(
  error: string | null | undefined,
  action?: string,
): string | null {
  if (!error) return null;
  const classified = classify(error);
  if (classified) return classified.userMessage;
  if (looksLikeInternalError(error)) {
    return action ? (PER_ACTION_FALLBACK[action] ?? "Akce se nezdařila.") : "Akce se nezdařila.";
  }
  if (error.length > 120) {
    return action ? (PER_ACTION_FALLBACK[action] ?? error.slice(0, 100) + "…") : error.slice(0, 100) + "…";
  }
  return error;
}
