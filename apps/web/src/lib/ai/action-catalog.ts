/**
 * Action catalog for assistant-suggested actions (Plan 5B.4).
 * Defines all action types, their metadata, and validation requirements.
 */

export type ActionType =
  | "open_review"
  | "select_client_candidate"
  | "confirm_create_new_client"
  | "create_task_draft"
  | "create_followup_draft"
  | "create_email_draft"
  | "prepare_payment_apply"
  | "prepare_contract_apply"
  | "request_missing_data"
  | "show_portal_payment_preview";

export type ExecutionMode = "manual_only" | "draft_only" | "approval_required" | "auto_disabled";

export type ActionDefinition = {
  type: ActionType;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  executionMode: ExecutionMode;
  entityTypes: string[];
};

export type ActionPayload = {
  actionType: ActionType;
  label: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
  executionMode: ExecutionMode;
  blockedReason?: string;
  qualityGateStatus?: string;
};

export const ACTION_DEFINITIONS: ActionDefinition[] = [
  {
    type: "open_review",
    label: "Otevřít review",
    description: "Navigace na detail review položky.",
    requiresConfirmation: false,
    executionMode: "manual_only",
    entityTypes: ["review"],
  },
  {
    type: "select_client_candidate",
    label: "Vybrat kandidáta klienta",
    description: "Výběr kandidáta pro spárování dokumentu s klientem.",
    requiresConfirmation: true,
    executionMode: "manual_only",
    entityTypes: ["client"],
  },
  {
    type: "confirm_create_new_client",
    label: "Vytvořit nového klienta",
    description: "Potvrzení vytvoření nového klienta z review dat.",
    requiresConfirmation: true,
    executionMode: "approval_required",
    entityTypes: ["client"],
  },
  {
    type: "create_task_draft",
    label: "Vytvořit úkol (draft)",
    description: "Připraví návrh úkolu. Poradce musí potvrdit.",
    requiresConfirmation: true,
    executionMode: "draft_only",
    entityTypes: ["task"],
  },
  {
    type: "create_followup_draft",
    label: "Vytvořit follow-up (draft)",
    description: "Připraví návrh follow-up aktivity.",
    requiresConfirmation: true,
    executionMode: "draft_only",
    entityTypes: ["task", "email"],
  },
  {
    type: "create_email_draft",
    label: "Vytvořit email (draft)",
    description: "Připraví návrh emailu. Poradce musí schválit a odeslat.",
    requiresConfirmation: true,
    executionMode: "draft_only",
    entityTypes: ["email"],
  },
  {
    type: "prepare_payment_apply",
    label: "Připravit platbu k aplikaci",
    description: "Vyhodnotí a připraví platební nastavení k aplikaci do portálu.",
    requiresConfirmation: true,
    executionMode: "approval_required",
    entityTypes: ["payment"],
  },
  {
    type: "prepare_contract_apply",
    label: "Připravit smlouvu k aplikaci",
    description: "Vyhodnotí připravenost review k aplikaci do CRM.",
    requiresConfirmation: true,
    executionMode: "approval_required",
    entityTypes: ["review"],
  },
  {
    type: "request_missing_data",
    label: "Vyžádat chybějící data",
    description: "Připraví žádost o doplnění chybějících údajů.",
    requiresConfirmation: true,
    executionMode: "draft_only",
    entityTypes: ["review", "payment"],
  },
  {
    type: "show_portal_payment_preview",
    label: "Náhled platby v portálu",
    description: "Zobrazí náhled platebního nastavení před aplikací.",
    requiresConfirmation: false,
    executionMode: "manual_only",
    entityTypes: ["payment"],
  },
];

export function getActionDefinition(type: ActionType): ActionDefinition | undefined {
  return ACTION_DEFINITIONS.find((d) => d.type === type);
}

export function buildActionPayload(
  type: ActionType,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown> = {},
  overrides?: Partial<ActionPayload>,
): ActionPayload {
  const def = getActionDefinition(type);
  return {
    actionType: type,
    label: def?.label ?? type,
    entityType,
    entityId,
    payload,
    requiresConfirmation: def?.requiresConfirmation ?? true,
    executionMode: def?.executionMode ?? "manual_only",
    ...overrides,
  };
}
