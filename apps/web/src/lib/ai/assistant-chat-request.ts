/**
 * Shared payload for POST /api/ai/assistant/chat (portal contact context + session).
 */

const PORTAL_CONTACT_UUID =
  /^\/portal\/contacts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

const PORTAL_PIPELINE_UUID =
  /^\/portal\/pipeline\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Vrací ID kontaktu z cesty `/portal/contacts/[uuid]/…`. */
export function parsePortalContactIdFromPathname(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const m = pathname.match(PORTAL_CONTACT_UUID);
  return m?.[1]?.toLowerCase();
}

/** Vrací ID obchodu z cesty `/portal/pipeline/[uuid]/…`. */
export function parsePortalOpportunityIdFromPathname(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const m = pathname.match(PORTAL_PIPELINE_UUID);
  return m?.[1]?.toLowerCase();
}

export type AssistantChatRequestBody = {
  message: string;
  sessionId?: string;
  orchestration?: "legacy" | "canonical";
  channel?: "web_drawer" | "mobile" | "contact_detail" | "dashboard" | "client_portal_bridge";
  /** 6F: explicitní potvrzení plánu bez psaní „ano" do zprávy */
  confirmExecution?: boolean;
  cancelExecution?: boolean;
  /** 6C: ID kroků (`ExecutionStep.stepId`) k provedení; vynechání = všechny (kompatibilní s „ano") */
  selectedStepIds?: string[];
  activeContext?: {
    clientId?: string | null;
    opportunityId?: string | null;
    reviewId?: string | null;
    paymentContactId?: string | null;
  };
};

export function buildAssistantChatRequestBody(
  message: string,
  opts: {
    sessionId?: string;
    routeContactId: string | null;
    routeOpportunityId?: string | null;
    orchestration?: "legacy" | "canonical";
    channel?: "web_drawer" | "mobile" | "contact_detail" | "dashboard" | "client_portal_bridge";
  },
): AssistantChatRequestBody {
  const body: AssistantChatRequestBody = {
    message,
    orchestration: opts.orchestration ?? "canonical",
    channel: opts.routeContactId ? "contact_detail" : (opts.channel ?? "web_drawer"),
  };
  if (opts.sessionId?.trim()) body.sessionId = opts.sessionId.trim();
  const cid = opts.routeContactId?.trim();
  const oid = opts.routeOpportunityId?.trim();
  body.activeContext = {
    clientId: cid || null,
    opportunityId: oid || null,
  };
  return body;
}

/** 6F / 6C — potvrzení výběru kroků bez uživatelské zprávy. */
export function buildAssistantConfirmExecutionBody(opts: {
  sessionId?: string;
  routeContactId: string | null;
  routeOpportunityId?: string | null;
  channel?: AssistantChatRequestBody["channel"];
  /** Když vynecháno → server provede všechny čekající kroky (kompatibilní se starým „ano"). */
  selectedStepIds?: string[];
}): AssistantChatRequestBody {
  const base = buildAssistantChatRequestBody("", {
    sessionId: opts.sessionId,
    routeContactId: opts.routeContactId,
    routeOpportunityId: opts.routeOpportunityId,
    channel: opts.channel,
  });
  const out: AssistantChatRequestBody = {
    ...base,
    message: "",
    confirmExecution: true,
  };
  if (opts.selectedStepIds !== undefined) out.selectedStepIds = opts.selectedStepIds;
  return out;
}

export function buildAssistantCancelPlanBody(opts: {
  sessionId?: string;
  routeContactId: string | null;
  routeOpportunityId?: string | null;
  channel?: AssistantChatRequestBody["channel"];
}): AssistantChatRequestBody {
  const base = buildAssistantChatRequestBody("", {
    sessionId: opts.sessionId,
    routeContactId: opts.routeContactId,
    routeOpportunityId: opts.routeOpportunityId,
    channel: opts.channel,
  });
  return { ...base, message: "", cancelExecution: true };
}
