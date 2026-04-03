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
