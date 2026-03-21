import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../../../integrations/auth";
import { getValidGmailAccessToken } from "@/lib/integrations/google-gmail-integration-service";
import { modifyGmailMessage } from "@/lib/integrations/google-gmail";

type ModifyPayload = {
  addLabelIds?: string[];
  removeLabelIds?: string[];
};

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;
  const { id } = await context.params;

  const body = (await request.json().catch(() => ({}))) as ModifyPayload;
  const addLabelIds = Array.isArray(body.addLabelIds) ? body.addLabelIds : [];
  const removeLabelIds = Array.isArray(body.removeLabelIds) ? body.removeLabelIds : [];

  try {
    const accessToken = await getValidGmailAccessToken(userId, tenantId);
    const message = await modifyGmailMessage(accessToken, id, {
      addLabelIds,
      removeLabelIds,
    });
    return NextResponse.json({
      ok: true,
      id: message.id,
      threadId: message.threadId,
      labelIds: message.labelIds ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
